import { google } from "googleapis";
import { getTokens, upsertTokens } from "../models/google.model.js";

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_SECRET
  );
}

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly", 
  "https://www.googleapis.com/auth/gmail.send",
  'https://www.googleapis.com/auth/gmail.readonly',
  "https://www.googleapis.com/auth/contacts.readonly",
  "openid",
];

function normalizeExpiry(expiry_date) {
  // expiry_date may come as number, string, null
  const n = Number(expiry_date || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function defaultExpiry() {
  // 50 minutes from now
  return Date.now() + 50 * 60 * 1000;
}

export async function saveMergedTokens(userId, prior, fresh) {
  const merged = {
    access_token: fresh.access_token || prior?.access_token || "",
    refresh_token: fresh.refresh_token || prior?.refresh_token || null,
    scope: fresh.scope || prior?.scope || "",
    token_type: fresh.token_type || prior?.token_type || "Bearer",
    expiry_date: normalizeExpiry(fresh.expiry_date) || normalizeExpiry(prior?.expiry_date) || defaultExpiry(),
    id_token: fresh.id_token || prior?.id_token || null
  };
  await upsertTokens(userId, merged);
  return merged;
}

export async function refreshFromRefreshToken(userId, refresh_token) {
  const client = buildOAuthClient();
  client.setCredentials({ refresh_token });
  const { credentials } = await client.refreshAccessToken();

  const merged = await saveMergedTokens(userId, { refresh_token }, credentials);
  client.setCredentials(merged);

  return client;
}

export async function getGoogleClientForUser(userId) {
  const row = await getTokens(userId);
  if (!row) {
    const err = new Error("Google not connected");
    err.code = "NOT_CONNECTED";
    throw err;
  }

  const client = buildOAuthClient();
  const expiry = normalizeExpiry(row.expiry_date);
  const needsRefresh = !row.access_token || !expiry || expiry - Date.now() < 60_000;

  if (needsRefresh) {
    if (!row.refresh_token) {
      const err = new Error("Missing refresh token, reconnect at /auth/google/connect");
      err.code = "NO_REFRESH";
      throw err;
    }
    try {
      await refreshFromRefreshToken(userId, row.refresh_token);
    } catch (e) {
      const msg = String(e?.message || "");
      if (/invalid_grant/i.test(msg)) {
        const err = new Error("Refresh failed, reconnect at /auth/google/connect");
        err.code = "REFRESH_FAILED";
        throw err;
      }
      throw e;
    }
  } else {
    client.setCredentials({
      access_token: row.access_token,
      refresh_token: row.refresh_token || undefined,
      expiry_date: expiry
    });
  }

  return client;
}

export async function withAutoRetry(userId, fn) {
  const attempt = async () => {
    const auth = await getGoogleClientForUser(userId);
    return fn(auth);
  };

  try {
    return await attempt();
  } catch (err) {
    const msg = String(err?.message || err);
    const httpCode = err?.code || err?.response?.status;

    // Retry once on obvious auth failures
    if (httpCode === 401 || /invalid_credentials|invalid_grant|Unauthorized/i.test(msg)) {
      const row = await getTokens(userId);
      if (!row || !row.refresh_token) {
        const e2 = new Error("Google not connected, reconnect at /auth/google/connect");
        e2.code = "NOT_CONNECTED";
        throw e2;
      }
      // Force refresh from stored refresh_token
      await refreshFromRefreshToken(userId, row.refresh_token);
      return attempt();
    }
    throw err;
  }
}

// Quick status check for your UI
export async function isGoogleConnected(userId) {
  const row = await getTokens(userId);
  if (!row) return { connected: false, reason: "no_tokens" };
  if (!row.refresh_token) return { connected: false, reason: "no_refresh_token" };
  const expiry = normalizeExpiry(row.expiry_date);
  const expSoon = expiry && expiry - Date.now() < 60_000;
  return { connected: true, expiringSoon: !!expSoon };
}

export async function isGoogleStillConnected(userId) {
  const tokens = await getTokens(userId);
  if (!tokens?.access_token) return false;

  const token = await refreshFromRefreshToken(userId, tokens.refresh_token);

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token.credentials.access_token}`);
  // if (!res.ok) throw new Error("Invalid or expired token");

  const data = await res.json();
  
  const granted = data.scope.split(" ");

  // Find missing scopes
  const missing = scopes.filter(scope => !granted.includes(scope));

  if (missing.length > 0) {
    console.log("Missing scopes:", missing);
    return false;
  }
  return true;
}
