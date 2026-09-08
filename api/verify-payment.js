import { getFirestore, json, refreshMercadoPagoToken, requireMethod } from "./_lib.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const { paymentId, slug, participantId } = req.body || {};
    if (!paymentId || !slug || !participantId) {
      return json(res, 400, { error: "missing_payment_data" });
    }

    const firestore = getFirestore();
    const accountRef = firestore.collection("shared_accounts").doc(String(slug));
    const accountSnapshot = await accountRef.get();
    const account = accountSnapshot.data();
    if (!accountSnapshot.exists || !account) {
      return json(res, 404, { error: "account_not_found" });
    }

    const connectionRef = firestore.collection("payment_connections").doc(String(account.creatorUid));
    const connectionSnapshot = await connectionRef.get();
    const connection = { ref: connectionRef, ...(connectionSnapshot.data() || {}) };
    if (!connection.mpRefreshToken) {
      return json(res, 409, { error: "creator_not_connected" });
    }

    const accessToken = await refreshMercadoPagoToken(connection);
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      return json(res, 502, { error: "mercadopago_payment_lookup_failed" });
    }

    let reference;
    try {
      reference = JSON.parse(payment.external_reference || "{}");
    } catch {
      reference = {};
    }
    if (reference.slug !== slug || reference.participantId !== participantId) {
      return json(res, 403, { error: "payment_reference_mismatch" });
    }
    if (payment.status !== "approved") {
      return json(res, 200, { paid: false, status: payment.status });
    }

    await firestore.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(accountRef);
      const latest = latestSnapshot.data() || {};
      const participants = [...(latest.participants || [])];
      const participant = participants.find((entry) => entry.id === participantId);
      if (!participant) throw new Error("participant_not_found");
      participant.status = "paid";
      participant.paymentId = String(payment.id);
      participant.paidAt = new Date();
      transaction.update(accountRef, { participants, updatedAt: new Date() });
    });

    return json(res, 200, {
      paid: true,
      status: payment.status,
      paymentId: String(payment.id),
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "payment_verification_failed" });
  }
}
