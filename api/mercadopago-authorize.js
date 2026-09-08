import {
  appUrl,
  json,
  redirect,
  signState,
  verifyFirebaseToken,
} from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return json(res, 405, { error: "method_not_allowed" });
  try {
    const user = await verifyFirebaseToken(req);
    if (!process.env.MP_CLIENT_ID || !process.env.MP_OAUTH_STATE_SECRET) {
      return json(res, 500, { error: "mercadopago_not_configured" });
    }
    let returnUrl = `${appUrl}/?mercadopago=connected`;
    if (typeof req.query.return_url === "string") {
      const requestedUrl = new URL(req.query.return_url);
      if (requestedUrl.origin === appUrl) returnUrl = requestedUrl.toString();
    }
    const state = signState({
      uid: user.uid,
      returnUrl,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      client_id: process.env.MP_CLIENT_ID,
      response_type: "code",
      platform_id: "mp",
      redirect_uri: `${appUrl}/api/mercadopago-callback`,
      state,
    });
    return redirect(
      res,
      `https://auth.mercadopago.com/authorization?${params}`,
    );
  } catch (error) {
    return json(res, 401, { error: error.message || "authorization_failed" });
  }
}
