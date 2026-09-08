import {
  appUrl,
  firestore,
  json,
  readState,
  redirect,
  requireMethod,
} from "./_lib.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  try {
    const state = readState(req.query.state);
    if (!state.exp || state.exp < Date.now())
      throw new Error("oauth_state_expired");
    if (req.query.error)
      return redirect(res, `${state.returnUrl}&mercadopago=cancelled`);

    const tokenResponse = await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code: req.query.code,
          redirect_uri: `${appUrl}/api/mercadopago-callback`,
        }),
      },
    );
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token) {
      throw new Error("mercadopago_token_exchange_failed");
    }

    await firestore
      .collection("payment_connections")
      .doc(state.uid)
      .set({
        mpRefreshToken: token.refresh_token,
        mpUserId: String(token.user_id || ""),
        provider: "mercadopago",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return redirect(res, `${state.returnUrl}&mercadopago=connected`);
  } catch (error) {
    return json(res, 400, { error: error.message || "oauth_callback_failed" });
  }
}
