import crypto from "node:crypto";
import admin from "firebase-admin";

export const appUrl = (
  process.env.APP_URL || "https://te-debo-web.vercel.app"
).replace(/\/$/, "");

function serviceAccountFromEnvironment() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      return JSON.parse(
        Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          "base64",
        ).toString("utf8"),
      );
    } catch {
      throw new Error("invalid_firebase_service_account_base64");
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      );

      console.log("Firebase JSON fields:", {
        project_id: Boolean(serviceAccount.project_id),
        client_email: Boolean(serviceAccount.client_email),
        private_key: Boolean(serviceAccount.private_key),
      });

      return serviceAccount;
    } catch (error) {
      console.error("Firebase JSON parse error:", error);

      throw new Error("invalid_firebase_service_account_json");
    }
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.log("Firebase separate credentials:", {
      project_id: Boolean(process.env.FIREBASE_PROJECT_ID),
      client_email: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      private_key: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    });

    return {
      project_id: process.env.FIREBASE_PROJECT_ID,

      client_email: process.env.FIREBASE_CLIENT_EMAIL,

      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  throw new Error("firebase_admin_not_configured");
}

export function getAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountFromEnvironment()),
    });
  }
  return admin;
}

export function getFirestore() {
  return getAdmin().firestore();
}

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").json(body);
}

export function redirect(res, location) {
  res.status(302).setHeader("Location", location).end();
}

export function getBearerToken(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function verifyFirebaseToken(req) {
  const token = getBearerToken(req) || req.query?.id_token;
  if (!token) throw new Error("missing_firebase_token");
  return getAdmin().auth().verifyIdToken(token);
}

export function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.MP_OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function readState(value) {
  const parts = String(value || "").split(".");

  if (parts.length !== 2) {
    throw new Error("invalid_oauth_state");
  }

  const [encoded, signature] = parts;

  if (!encoded || !signature) {
    throw new Error("invalid_oauth_state");
  }

  const expected = crypto
    .createHmac("sha256", process.env.MP_OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("invalid_oauth_state");
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid_oauth_state_payload");
  }
}

export async function refreshMercadoPagoToken(connection) {
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      refresh_token: connection.mpRefreshToken,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token)
    throw new Error("mercadopago_refresh_failed");
  await connection.ref.set(
    {
      mpAccessToken: data.access_token,
      mpRefreshToken: data.refresh_token || connection.mpRefreshToken,
      mpUserId: String(data.user_id || connection.mpUserId || ""),
      updatedAt: getAdmin().firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return data.access_token;
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    json(res, 405, { error: "method_not_allowed" });
    return false;
  }
  return true;
}
