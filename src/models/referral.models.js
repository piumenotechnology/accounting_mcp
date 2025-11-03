// models/referralModels.js
import { pool } from '../config/db.js';

export const referralModels = {
  createReferralToken: async (referral, qty, schema_name, client_name) => {

    const sql = `
      INSERT INTO referral_tokens (referral, qty, is_active, schema_name, client_name)
      VALUES ($1, $2, true, $3, $4)
      RETURNING id, referral, qty, is_active, schema_name, client_name, created_at, updated_at
    `;
    try {
      const result = await pool.query(sql, [referral, qty, schema_name, client_name]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        const e = new Error('Referral already exists');
        e.status = 409;
        throw e;
      }
      const e = new Error(`Database query failed: ${error.message}`);
      e.status = 500;
      throw e;
    }
  },

  useReferralToken: async (referral, user_id) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE referral_tokens
        SET qty = qty - 1, updated_at = now()
        WHERE referral = $1 AND qty > 0
        RETURNING id, referral, qty, schema_name
      `;
      const updateResult = await client.query(updateQuery, [referral]);

      if (updateResult.rowCount === 0) {
        const e = new Error('Invalid or exhausted referral token');
        e.status = 400;
        throw e;
      }

      const token = updateResult.rows[0];

      const usageQuery = `
        INSERT INTO referral_token_usages (referral_token_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT ON CONSTRAINT uq_referral_usage DO NOTHING
        RETURNING id, used_at
      `;
      const usage = await client.query(usageQuery, [token.id, user_id]);

      if (usage.rowCount === 0) {
        await client.query('UPDATE referral_tokens SET qty = qty + 1, updated_at = now() WHERE id = $1', [token.id]);
        const e = new Error('User already used this referral token');
        e.status = 409;
        throw e;
      }

      await client.query('COMMIT');
      return { token, usage_id: usage.rows[0].id, used_at: usage.rows[0].used_at };
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.status) error.status = 500;
      throw error;
    } finally {
      client.release();
    }
  },

  revertReferralToken: async (referral, user_id) => {
    const client = await pool.connect();    
        try {
        await client.query('BEGIN');
            const tokenQuery = `
                SELECT id FROM referral_tokens WHERE referral = $1
            `;
            const tokenResult = await client.query(tokenQuery, [referral]);
            if (tokenResult.rowCount === 0) {
                const e = new Error('Invalid referral token');
                e.status = 400;
                throw e;
            }
            const token_id = tokenResult.rows[0].id;
            const deleteUsageQuery = `
                DELETE FROM referral_token_usages
                WHERE referral_token_id = $1 AND user_id = $2
                RETURNING id
                `;
            const deleteResult = await client.query(deleteUsageQuery, [token_id, user_id]);
            if (deleteResult.rowCount === 0) {
                const e = new Error('Referral token usage not found for user');
                e.status = 404;
                throw e;
            }
            const updateTokenQuery = `
                UPDATE referral_tokens
                SET qty = qty + 1, updated_at = now()
                WHERE id = $1
            `;
        await client.query(updateTokenQuery, [token_id]);
            await client.query('COMMIT');
            return { message: 'Referral token usage reverted successfully' };
        }
        catch (error) {
            await client.query('ROLLBACK');
            if (!error.status) error.status = 500;
            throw error;
        }   
        finally {
            client.release();
        }
  },

  getReferralById: async (id) => {
    const sql = `
      SELECT id, referral, qty, is_active, schema_name, created_at, updated_at
      FROM referral_tokens
      WHERE id = $1
    `;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },

  getReferrals: async ({ limit = 50, offset = 0, search = '' }) => {
    const params = [];
    const whereParts = [];

    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`(referral ILIKE $${params.length} OR schema_name ILIKE $${params.length})`);
    }

    params.push(limit, offset);
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const listSql = `
      SELECT id, referral, qty, is_active, schema_name, created_at, updated_at
      FROM referral_tokens
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM referral_tokens ${where}`;

    const [list, count] = await Promise.all([
      pool.query(listSql, params),
      pool.query(countSql, where ? [params[0]] : []),
    ]);

    return { items: list.rows, total: count.rows[0].total };
  },

  deleteReferral: async (id) => {
    const result = await pool.query(`DELETE FROM referral_tokens WHERE id = $1 RETURNING id`, [id]);
    return result.rowCount > 0;
  },

  getReferralUsageByUser: async (user_id) => {
    const result = await pool.query(
      `SELECT 1 FROM referral_token_usages WHERE user_id = $1 LIMIT 1`,
      [user_id]
    );
    return result.rowCount > 0;
  },

  getScope: async (user_id) => {
    const sql = `
      SELECT rt.scopes_json AS scopes
      FROM referral_token_usages rtu
      JOIN referral_tokens rt ON rtu.referral_token_id = rt.id
      WHERE rtu.user_id = $1
      ORDER BY rtu.used_at DESC, rtu.id DESC
      LIMIT 1
    `;
    const result = await pool.query(sql, [user_id]);
    return result.rows[0]?.scopes ?? [];
  }

};


