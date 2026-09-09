import {
  appUrl,
  getFirestore,
  json,
  refreshMercadoPagoToken,
  requireMethod,
} from "./_lib.js";

function selectedAmount(account, participant) {
  if (account.mode !== "items") {
    return Number(participant.amountCents || 0);
  }

  return (account.items || []).reduce((total, item) => {
    const quantity = Number(participant.selections?.[item.id] || 0);
    const units = Math.max(1, Number(item.quantity || 1));
    const itemTotal = Number(item.totalCents || 0);

    if (!quantity) return total;

    const unit = Math.floor(itemTotal / units);

    return total + quantity * unit + Math.min(quantity, itemTotal % units);
  }, 0);
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const { slug, participantId } = req.body || {};

    if (!slug || !participantId) {
      return json(res, 400, {
        error: "missing_payment_data",
      });
    }

    const firestore = getFirestore();

    const accountRef = firestore
      .collection("shared_accounts")
      .doc(String(slug));

    const accountSnapshot = await accountRef.get();

    if (!accountSnapshot.exists) {
      return json(res, 404, {
        error: "account_not_found",
      });
    }

    const account = accountSnapshot.data();

    const participant = (account.participants || []).find(
      (entry) => entry.id === participantId,
    );

    if (!participant || participant.isCreator) {
      return json(res, 400, {
        error: "participant_not_payable",
      });
    }

    if (participant.status === "paid") {
      return json(res, 409, {
        error: "already_paid",
      });
    }

    const amountCents = selectedAmount(account, participant);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return json(res, 400, {
        error: "invalid_amount",
      });
    }

    const connectionRef = firestore
      .collection("payment_connections")
      .doc(String(account.creatorUid));

    const connectionSnapshot = await connectionRef.get();

    if (!connectionSnapshot.exists) {
      return json(res, 409, {
        error: "creator_not_connected",
      });
    }

    const connection = {
      ref: connectionRef,
      ...connectionSnapshot.data(),
    };

    if (!connection.mpRefreshToken) {
      return json(res, 409, {
        error: "creator_not_connected",
      });
    }

    const accessToken = await refreshMercadoPagoToken(connection);

    const externalReference = JSON.stringify({
      slug: String(slug),
      participantId: String(participantId),
      creatorUid: String(account.creatorUid),
    });

    const preferenceResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: `tedebo-${slug}-${participantId}`.slice(0, 256),
              title: `Parte de ${account.name || "la cuenta"}`,
              description: `Pago de ${participant.name || "participante"}`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: amountCents / 100,
            },
          ],

          external_reference: externalReference,

          back_urls: {
            success:
              `${appUrl}/c/${encodeURIComponent(slug)}` +
              `?payment=approved&participantId=${encodeURIComponent(participantId)}`,

            pending:
              `${appUrl}/c/${encodeURIComponent(slug)}` +
              `?payment=pending&participantId=${encodeURIComponent(participantId)}`,

            failure:
              `${appUrl}/c/${encodeURIComponent(slug)}` +
              `?payment=failure&participantId=${encodeURIComponent(participantId)}`,
          },

          auto_return: "approved",

          notification_url: `${appUrl}/api/mercadopago-webhook`,
        }),
      },
    );

    const preference = await preferenceResponse.json();

    if (!preferenceResponse.ok || !preference.init_point) {
      console.error("Mercado Pago preference error:", preference);

      return json(res, 502, {
        error: "mercadopago_preference_failed",
      });
    }

    await firestore
      .collection("pending_payments")
      .doc(String(preference.id))
      .set({
        slug: String(slug),
        participantId: String(participantId),
        creatorUid: String(account.creatorUid),
        amountCents,
        preferenceId: String(preference.id),
        createdAt: new Date(),
      });

    return json(res, 200, {
      checkoutUrl: preference.init_point,
      preferenceId: preference.id,
      amountCents,
    });
  } catch (error) {
    console.error("Create payment error:", error);

    return json(res, 500, {
      error: error.message || "payment_creation_failed",
    });
  }
}
