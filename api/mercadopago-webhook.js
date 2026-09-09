import {
  getFirestore,
  json,
  refreshMercadoPagoToken,
  requireMethod,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const paymentId = req.body?.data?.id || req.query?.["data.id"];

  if (!paymentId) {
    return json(res, 200, {
      received: true,
    });
  }

  try {
    const firestore = getFirestore();

    const pendingSnapshot = await firestore
      .collection("pending_payments")
      .where("paymentId", "==", String(paymentId))
      .limit(1)
      .get();

    let pendingPayment = null;

    if (!pendingSnapshot.empty) {
      pendingPayment = pendingSnapshot.docs[0].data();
    }

    if (!pendingPayment) {
      console.log("Payment not found in pending_payments:", paymentId);
    }

    let connectionDoc = null;
    let payment = null;

    if (pendingPayment?.creatorUid) {
      const connectionRef = firestore
        .collection("payment_connections")
        .doc(String(pendingPayment.creatorUid));

      const connectionSnapshot = await connectionRef.get();

      if (connectionSnapshot.exists) {
        connectionDoc = connectionSnapshot;
      }
    }
    if (!connectionDoc) {
      const connections = await firestore
        .collection("payment_connections")
        .limit(100)
        .get();

      for (const candidate of connections.docs) {
        const connection = {
          ref: candidate.ref,
          ...candidate.data(),
        };

        if (!connection.mpRefreshToken) continue;

        try {
          const accessToken = await refreshMercadoPagoToken(connection);

          const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
              paymentId,
            )}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          if (!response.ok) continue;

          const candidatePayment = await response.json();

          let reference = {};

          try {
            reference = JSON.parse(candidatePayment.external_reference || "{}");
          } catch {
            reference = {};
          }

          if (
            reference.creatorUid &&
            reference.slug &&
            reference.participantId
          ) {
            connectionDoc = candidate;
            payment = candidatePayment;
            break;
          }
        } catch (error) {
          console.error("Webhook connection lookup error:", error);
        }
      }
    }

    if (!connectionDoc) {
      console.log(
        "Could not identify Mercado Pago connection for payment:",
        paymentId,
      );

      return json(res, 200, {
        received: true,
      });
    }

    const connection = {
      ref: connectionDoc.ref,
      ...connectionDoc.data(),
    };

    if (!payment) {
      const accessToken = await refreshMercadoPagoToken(connection);

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
          paymentId,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!paymentResponse.ok) {
        console.error("Mercado Pago payment lookup failed:", paymentId);

        return json(res, 200, {
          received: true,
        });
      }

      payment = await paymentResponse.json();
    }

    if (payment.status !== "approved") {
      console.log("Payment is not approved:", paymentId, payment.status);

      return json(res, 200, {
        received: true,
      });
    }

    let reference = {};

    try {
      reference = JSON.parse(payment.external_reference || "{}");
    } catch {
      reference = {};
    }

    const slug = reference.slug;
    const participantId = reference.participantId;
    const creatorUid = reference.creatorUid;

    if (!slug || !participantId || !creatorUid) {
      console.error(
        "Invalid Mercado Pago external_reference:",
        payment.external_reference,
      );

      return json(res, 200, {
        received: true,
      });
    }
    if (String(connectionDoc.id) !== String(creatorUid)) {
      console.error("Payment creator mismatch:", paymentId);

      return json(res, 200, {
        received: true,
      });
    }

    const accountRef = firestore
      .collection("shared_accounts")
      .doc(String(slug));

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(accountRef);
      const account = snapshot.data();

      if (!account) {
        throw new Error("account_not_found");
      }

      if (String(account.creatorUid) !== String(creatorUid)) {
        throw new Error("creator_mismatch");
      }

      const participants = [...(account.participants || [])];

      const participant = participants.find(
        (entry) => entry.id === participantId,
      );

      if (!participant) {
        throw new Error("participant_not_found");
      }
      if (participant.status === "paid") {
        return;
      }

      participant.status = "paid";
      participant.paymentId = String(payment.id);
      participant.paidAt = new Date();

      transaction.update(accountRef, {
        participants,
        updatedAt: new Date(),
      });
    });

    console.log(
      "Payment successfully registered:",
      paymentId,
      slug,
      participantId,
    );

    return json(res, 200, {
      received: true,
    });
  } catch (error) {
    console.error("Mercado Pago webhook error:", error);

    return json(res, 200, {
      received: true,
    });
  }
}
