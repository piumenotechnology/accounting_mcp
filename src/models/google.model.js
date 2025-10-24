import {pool} from '../config/db.js';

export async function upsertTokens(userId, tokens) {
  const { access_token, refresh_token, scope, token_type, expiry_date, id_token } = tokens;
  const res = await pool.query(`
    INSERT INTO google_oauth_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, id_token)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_tokens.refresh_token),
      scope = EXCLUDED.scope,
      token_type = EXCLUDED.token_type,
      expiry_date = EXCLUDED.expiry_date,
      id_token = COALESCE(EXCLUDED.id_token, google_oauth_tokens.id_token),
      updated_at = NOW()
    RETURNING *;
  `, [userId, access_token, refresh_token || null, scope, token_type, expiry_date, id_token || null]);
  return res.rows[0];
}

export async function getTokens(userId) {
  const res = await pool.query(`SELECT * FROM google_oauth_tokens WHERE user_id = $1`, [userId]);
  return res.rows[0] || null;
}

export async function deleteTokens(userId) {
  const res = await pool.query(`DELETE FROM google_oauth_tokens WHERE user_id = $1 RETURNING *`, [userId]);
  return res.rows[0] || null;
}

