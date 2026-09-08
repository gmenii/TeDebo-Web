import {
  firestore,
  json,
  refreshMercadoPagoToken,
  requireMethod,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  const paymentId = req.body?.data?.id || req.query?.["data.id"];
  if (!paymentId) return json(res, 200, { received: true });

  try {
    const connections = await firestore
      .collection("payment_connections")
      .limit(100)
      .get();
    for (const connectionDoc of connections.docs) {
      const connection = { ref: connectionDoc.ref, ...connectionDoc.data() };
      if (!connection.mpRefreshToken) continue;
      try {
        const accessToken = await refreshMercadoPagoToken(connection);
        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!response.ok) continue;
        const payment = await response.json();
        if (payment.status !== "approved") break;
        let reference;
        try {
          reference = JSON.parse(payment.external_reference || "{}");
        } catch {
          reference = {};
        }
        if (!reference.slug || !reference.participantId) break;
        const accountRef = firestore
          .collection("shared_accounts")
          .doc(reference.slug);
        await firestore.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(accountRef);
          const account = snapshot.data();
          if (!account || account.creatorUid !== connectionDoc.id) return;
          const participants = [...(account.participants || [])];
          const participant = participants.find(
            (entry) => entry.id === reference.participantId,
          );
          if (!participant) return;
          participant.status = "paid";
          participant.paymentId = String(payment.id);
          participant.paidAt = new Date();
          transaction.update(accountRef, {
            participants,
            updatedAt: new Date(),
          });
        });
        break;
      } catch {
        continue;
      }
    }
    return json(res, 200, { received: true });
  } catch {
    return json(res, 200, { received: true });
  }
}
