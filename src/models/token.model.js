import { pool } from '../config/db.js';
import { hashToken } from '../services/tokenServices.js';

export const tokenModel = {
    createToken: async (token, client = pool) => {
        const query = 'INSERT INTO tokens (token, status, remains) VALUES ($1, $2, $3) RETURNING *';
        const values = [token, true, 10]; // Default status is 'active' and remains is 0
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the newly created token
        } catch (error) {
            console.error('❌ Error creating token:', error.message);
            throw new Error('Database query failed');
        }
    },

    updateToken: async (tokenId, newStatus, newRemains, client = pool) => {
        const query = 'UPDATE tokens SET status = $1, remains = $2 token = $3 RETURNING *';
        const values = [newStatus, newRemains, tokenId];
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the updated token
        } catch (error) {
            console.error('❌ Error updating token:', error.message);
            throw new Error('Database query failed');
        }
    },

    deleteToken: async (tokenId) => {
        const query = 'DELETE FROM tokens WHERE token = $1 RETURNING *';
        const values = [tokenId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the deleted token
        } catch (error) {
            console.error('❌ Error deleting token:', error.message);
            throw new Error('Database query failed');
        }
    },

    checkToken: async (tokenCode) => {
        const query = 'SELECT * FROM tokens where token = $1';
        const values = [tokenCode]
        try {
            const result = await pool.query(query, values);
            return result.rows[0]
        } catch (error) {
            console.error('❌ Error get token:', error.message);
            throw new Error('Database check token failed');
        }
    },

    updateRefreshToken: async (userId, refreshToken) => {
        const query = 'UPDATE users SET refresh_token = $1 WHERE id = $2 RETURNING *';
        const values = [refreshToken, userId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the updated user with new refresh token
        } catch (error) {
            console.error('❌ Error updating refresh token:', error.message);
            throw new Error('Database query failed');
        }
    },

    // create a refresh token row
    createRefreshToken: async (userId, rawToken, days = 30) => {
        const tokenHash = hashToken(rawToken);
        const q = `
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, now() + ($3 || ' days')::interval)
        RETURNING id, user_id, created_at, expires_at, revoked_at`;
        const { rows } = await pool.query(q, [userId, tokenHash, days]);
        return rows[0];
    },

    // find a refresh token by its raw value
    findRefreshToken: async (rawToken) => {
        const tokenHash = hashToken(rawToken);
        const q = `
        SELECT id, user_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = $1
        LIMIT 1`;
        const { rows } = await pool.query(q, [tokenHash]);
        return rows[0] || null;
    },

    // revoke a token by raw token
    revokeRefreshToken: async (rawToken) => {
        const tokenHash = hashToken(rawToken);
        await pool.query(
        `UPDATE refresh_tokens SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash]
        );
    },

    // revoke by id, used during rotation
    revokeRefreshTokenById: async (id) => {
        await pool.query(
        `UPDATE refresh_tokens SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL`,
        [id]
        );
    },
    
    // revoke all active tokens for a user
    revokeAllRefreshTokensForUser: async (userId) => {
        await pool.query(
        `UPDATE refresh_tokens SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
        );
    }
}
