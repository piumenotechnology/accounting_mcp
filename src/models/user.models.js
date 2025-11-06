import { pool } from '../config/db.js';

export const authModels = {
    userGoogle: async (googleUserData) => {
        const { google_id, email, name, picture } = googleUserData;

        const existingUserQuery = 'SELECT * FROM users WHERE email = $1';
        try {
            const existingUserResult = await pool.query(existingUserQuery, [email]);
            let user = existingUserResult.rows[0];

            if (!user) {
                // Create user if not exists
                const insertQuery = `
                    INSERT INTO users (google_id, name, email, picture)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *`;
                const values = [google_id, name, email, picture];
                const result = await pool.query(insertQuery, values);
                user = result.rows[0];
            } else if (!user.google_id) {
                // Update existing user to link Google account
                const updateQuery = `
                    UPDATE users SET google_id = $1, picture = $2
                    WHERE id = $3 RETURNING *`;
                const result = await pool.query(updateQuery, [google_id, picture, user.id]);
                user = result.rows[0];
            }
            return user;
        } catch (error) {
            console.error('❌ Error in googleLoginUser:', error.message);
            throw new Error('Database query failed');
        }
    },
    getUserByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = $1';   
        try {
            const result = await pool.query(query, [email]);
            return result.rows[0];
        }catch (error) {
            console.error('❌ Error in getUserByEmail:', error.message);
            throw new Error('Database query failed');
        }
    },
    getUserByid: async (id) => {
        const query = 'SELECT * FROM users WHERE id = $1';  
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Error in getUserByid:', error.message);
            throw new Error('Database query failed');
        }
    },
    getAllUsers: async () => {
        const query = 'SELECT * FROM users';
        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('❌ Error in getAllUsers:', error.message);
            throw new Error('Database query failed');
        }
    },
    getActiveUser: async () => {
       const query = `SELECT 
                        u.name,
                        COUNT(*) AS total_chat,
                        MAX(m.created_at) AS last_message_at
                        FROM messages m
                        JOIN conversations c ON c.id = m.conversation_id
                        JOIN users u ON u.id = c.user_id
                        WHERE m."role" = 'user'
                        GROUP BY u.name
                        ORDER BY last_message_at DESC`
        try {
            const result = await pool.query(query)
            return result.rows
        } catch (error) {
            console.error('❌ Error in getActiveUser:', error.message)
            throw new Error('Database query failed');
        } 
    }
}