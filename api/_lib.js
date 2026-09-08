import crypto from "node:crypto";
import admin from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : null;

if (!admin.apps.length) {
  admin.initializeApp(
    serviceAccount
      ? { credential: admin.credential.cert(serviceAccount) }
      : { credential: admin.credential.applicationDefault() },
  );
}

export const firestore = admin.firestore();
export const timestamp = admin.firestore.Timestamp;
export const appUrl = (
  process.env.APP_URL || "https://te-debo-web.vercel.app"
).replace(/\/$/, "");

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
  return admin.auth().verifyIdToken(token);
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
  const [encoded, signature] = String(value || "").split(".");
  const expected = crypto
    .createHmac("sha256", process.env.MP_OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");
  if (
    !encoded ||
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    throw new Error("invalid_oauth_state");
  }
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
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
      mpRefreshToken: data.refresh_token || connection.mpRefreshToken,
      mpUserId: String(data.user_id || connection.mpUserId || ""),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
