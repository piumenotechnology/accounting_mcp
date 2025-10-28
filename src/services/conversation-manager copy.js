// import { pool } from '../config/db.js';

// class ConversationManager {
//   constructor() {
//     this.maxMessagesPerConversation = 50;
//   }

//   /**
//    * Initialize database tables
//    */
//   async initDatabase() {
//     const client = await pool.connect();
//     try {
//       await client.query('BEGIN');

//       // Create conversations table
//       await client.query(`
//         CREATE TABLE IF NOT EXISTS conversations (
//           id TEXT PRIMARY KEY,
//           user_id TEXT NOT NULL,
//           created_at TIMESTAMP NOT NULL DEFAULT NOW(),
//           updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
//           title TEXT,
//           metadata JSONB
//         )
//       `);

//       // Create messages table
//       await client.query(`
//         CREATE TABLE IF NOT EXISTS messages (
//           id SERIAL PRIMARY KEY,
//           conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//           role TEXT NOT NULL,
//           content TEXT NOT NULL,
//           timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
//           tool_calls JSONB,
//           tool_call_id TEXT,
//           metadata JSONB
//         )
//       `);

//       // Create pending confirmations table
//       await client.query(`
//         CREATE TABLE IF NOT EXISTS pending_confirmations (
//           id TEXT PRIMARY KEY,
//           conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//           user_id TEXT NOT NULL,
//           confirmation_type TEXT NOT NULL,
//           confirmation_id TEXT NOT NULL,
//           details JSONB NOT NULL,
//           created_at TIMESTAMP NOT NULL DEFAULT NOW(),
//           expires_at TIMESTAMP NOT NULL
//         )
//       `);

//       // Create indexes
//       await client.query(`
//         CREATE INDEX IF NOT EXISTS idx_messages_conversation 
//         ON messages(conversation_id, timestamp)
//       `);

//       await client.query(`
//         CREATE INDEX IF NOT EXISTS idx_conversations_user 
//         ON conversations(user_id, updated_at DESC)
//       `);

//       await client.query(`
//         CREATE INDEX IF NOT EXISTS idx_pending_confirmations_conversation 
//         ON pending_confirmations(conversation_id, expires_at)
//       `);

//       await client.query(`
//         CREATE INDEX IF NOT EXISTS idx_pending_confirmations_user 
//         ON pending_confirmations(user_id, expires_at)
//       `);

//       await client.query('COMMIT');
//       console.log('✅ Conversation database tables initialized successfully');
//     } catch (error) {
//       await client.query('ROLLBACK');
//       console.error('❌ Failed to initialize conversation tables:', error);
//       throw error;
//     } finally {
//       client.release();
//     }
//   }

//   /**
//    * Get or create a conversation
//    */
//   async getOrCreateConversation(conversationId, userId) {
//     const client = await pool.connect();

//     console.log('insert data into db');
//     try {
//       // Try to get existing conversation
//       let result = await client.query(
//         'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
//         [conversationId, userId]
//       );

//       if (result.rows.length > 0) {
//         return result.rows[0];
//       }

//       // Create new conversation
//       result = await client.query(
//         `INSERT INTO conversations (id, user_id, created_at, updated_at) 
//          VALUES ($1, $2, NOW(), NOW()) 
//          RETURNING *`,
//         [conversationId, userId]
//       );

//       return result.rows[0];
//     } finally {
//       client.release();
//     }
//   }

//   /**
//    * Get conversation history (messages)
//    */
//   async getConversationHistory(conversationId, limit = null) {
//     const actualLimit = limit || this.maxMessagesPerConversation;
    
//     const result = await pool.query(
//       `SELECT * FROM messages 
//        WHERE conversation_id = $1 
//        ORDER BY timestamp ASC 
//        LIMIT $2`,
//       [conversationId, actualLimit]
//     );

//     return result.rows.map(row => ({
//       role: row.role,
//       content: row.content,
//       ...(row.tool_calls && { tool_calls: row.tool_calls }),
//       ...(row.tool_call_id && { tool_call_id: row.tool_call_id }),
//       timestamp: row.timestamp
//     }));
//   }

//   /**
//    * Add a message to conversation
//    */
//   async addMessage(conversationId, role, content, metadata = {}) {
//     const client = await pool.connect();
//     try {
//       await client.query('BEGIN');

//       // Insert message
//       await client.query(
//         `INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id, metadata) 
//          VALUES ($1, $2, $3, $4, $5, $6)`,
//         [
//           conversationId,
//           role,
//           content,
//           metadata.tool_calls ? JSON.stringify(metadata.tool_calls) : null,
//           metadata.tool_call_id || null,
//           metadata.metadata ? JSON.stringify(metadata.metadata) : null
//         ]
//       );

//       // Update conversation timestamp
//       await client.query(
//         'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
//         [conversationId]
//       );

//       await client.query('COMMIT');
//     } catch (error) {
//       await client.query('ROLLBACK');
//       throw error;
//     } finally {
//       client.release();
//     }
//   }

//   /**
//    * Store pending confirmation
//    */
//   async storePendingConfirmation(conversationId, userId, confirmationType, confirmationId, details) {
//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//     await pool.query(
//       `INSERT INTO pending_confirmations 
//        (id, conversation_id, user_id, confirmation_type, confirmation_id, details, expires_at) 
//        VALUES ($1, $2, $3, $4, $5, $6, $7)
//        ON CONFLICT (id) DO UPDATE 
//        SET expires_at = $7, details = $6`,
//       [
//         `${conversationId}_${confirmationType}_pending`,
//         conversationId,
//         userId,
//         confirmationType,
//         confirmationId,
//         JSON.stringify(details),
//         expiresAt
//       ]
//     );
//   }

//   /**
//    * Get pending confirmation for conversation
//    */
//   async getPendingConfirmation(conversationId, userId) {
//     // Clean up expired confirmations first
//     await this.cleanupExpiredConfirmations();

//     const result = await pool.query(
//       `SELECT * FROM pending_confirmations 
//        WHERE conversation_id = $1 AND user_id = $2 
//        AND expires_at > NOW() 
//        ORDER BY created_at DESC 
//        LIMIT 1`,
//       [conversationId, userId]
//     );

//     if (result.rows.length > 0) {
//       const row = result.rows[0];
//       return {
//         confirmationType: row.confirmation_type,
//         confirmationId: row.confirmation_id,
//         details: row.details,
//         expiresAt: row.expires_at
//       };
//     }

//     return null;
//   }

//   /**
//    * Clear pending confirmation
//    */
//   async clearPendingConfirmation(conversationId, userId) {
//     await pool.query(
//       'DELETE FROM pending_confirmations WHERE conversation_id = $1 AND user_id = $2',
//       [conversationId, userId]
//     );
//   }

//   /**
//    * Clean up expired confirmations
//    */
//   async cleanupExpiredConfirmations() {
//     await pool.query(
//       'DELETE FROM pending_confirmations WHERE expires_at < NOW()'
//     );
//   }

//   /**
//    * Get user's conversations
//    */
//   async getUserConversations(userId, limit = 20) {
//     const result = await pool.query(
//       `SELECT c.*, 
//               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
//               (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY timestamp ASC LIMIT 1) as first_message
//        FROM conversations c 
//        WHERE c.user_id = $1 
//        ORDER BY c.updated_at DESC 
//        LIMIT $2`,
//       [userId, limit]
//     );

//     return result.rows;
//   }

//   /**
//    * Trim conversation to prevent it from growing too large
//    */
//   async trimConversation(conversationId, keepLast = 50) {
//     await pool.query(
//       `DELETE FROM messages 
//        WHERE conversation_id = $1 
//        AND id NOT IN (
//          SELECT id FROM messages 
//          WHERE conversation_id = $1 
//          ORDER BY timestamp DESC 
//          LIMIT $2
//        )`,
//       [conversationId, keepLast]
//     );
//   }

//   /**
//    * Delete a conversation
//    */
//   async deleteConversation(conversationId, userId) {
//     await pool.query(
//       'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
//       [conversationId, userId]
//     );
//   }

//   /**
//    * Update conversation title
//    */
//   async updateConversationTitle(conversationId, userId, title) {
//     await pool.query(
//       'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
//       [title, conversationId, userId]
//     );
//   }
// }

// export default ConversationManager;
