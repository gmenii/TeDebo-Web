import {
  appUrl,
  json,
  redirect,
  signState,
  verifyFirebaseToken,
} from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      error: "method_not_allowed",
    });
  }

  try {
    const user = await verifyFirebaseToken(req);

    if (!process.env.MP_CLIENT_ID) {
      return json(res, 500, {
        error: "mercadopago_not_configured",
      });
    }

    if (!process.env.MP_OAUTH_STATE_SECRET) {
      return json(res, 500, {
        error: "mercadopago_state_not_configured",
      });
    }

    const redirectUri = `${appUrl}/api/mercadopago-callback`;

    const state = signState({
      uid: user.uid,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.MP_CLIENT_ID,
      response_type: "code",
      platform_id: "mp",
      redirect_uri: redirectUri,
      state,
    });

    return redirect(
      res,
      `https://auth.mercadopago.com/authorization?${params.toString()}`,
    );
  } catch (error) {
    console.error("Mercado Pago authorize error:", error);

    console.error("Stack:", error?.stack);

    console.error("MP_CLIENT_ID exists:", Boolean(process.env.MP_CLIENT_ID));

    console.error(
      "MP_CLIENT_SECRET exists:",
      Boolean(process.env.MP_CLIENT_SECRET),
    );

    console.error(
      "MP_OAUTH_STATE_SECRET exists:",
      Boolean(process.env.MP_OAUTH_STATE_SECRET),
    );

    console.error("APP_URL:", process.env.APP_URL);

    return json(res, 500, {
      error: error.message || "authorization_failed",
    });
  }
}
