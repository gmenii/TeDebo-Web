import {
  appUrl,
  getAdmin,
  getFirestore,
  json,
  readState,
  redirect,
  requireMethod,
} from "./_lib.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  try {
    if (req.query.error) {
      console.error(
        "Mercado Pago OAuth cancelled:",
        req.query.error,
        req.query.error_description,
      );

      return redirect(res, `${appUrl}/?mercadopago=cancelled`);
    }

    if (!req.query.code) {
      throw new Error("mercadopago_missing_code");
    }

    if (!req.query.state) {
      throw new Error("mercadopago_missing_state");
    }

    const state = readState(req.query.state);

    if (!state.uid) {
      throw new Error("oauth_state_missing_uid");
    }

    if (!state.exp || state.exp < Date.now()) {
      throw new Error("oauth_state_expired");
    }

    const redirectUri = `${appUrl}/api/mercadopago-callback`;

    const tokenResponse = await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code: req.query.code,
          redirect_uri: redirectUri,
        }),
      },
    );

    const token = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Mercado Pago token exchange failed:", token);

      throw new Error("mercadopago_token_exchange_failed");
    }

    if (!token.access_token) {
      throw new Error("mercadopago_missing_access_token");
    }

    if (!token.refresh_token) {
      throw new Error("mercadopago_missing_refresh_token");
    }

    const db = getFirestore();
    const FieldValue = getAdmin().firestore.FieldValue;

    await db
      .collection("payment_connections")
      .doc(state.uid)
      .set(
        {
          provider: "mercadopago",

          mpUserId: String(token.user_id || ""),

          mpAccessToken: token.access_token,

          mpRefreshToken: token.refresh_token,

          mpTokenExpiresIn: Number(token.expires_in || 0),

          connectedAt: FieldValue.serverTimestamp(),

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return redirect(res, `${appUrl}/?mercadopago=connected`);
  } catch (error) {
    console.error("Mercado Pago OAuth callback error:", error);

    return json(res, 400, {
      error: error.message || "oauth_callback_failed",
    });
  }
}
