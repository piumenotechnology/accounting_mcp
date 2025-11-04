import { pool } from '../config/db.js';

export const chatModels = {
  // Create new conversation
  createConversation: async (user_id, model, title = 'New Chat') => {
    const query = `
      INSERT INTO conversations (user_id, model, title)
      VALUES ($1, $2, $3)
      RETURNING *`;
    try {
      const result = await pool.query(query, [user_id, model, title]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in createConversation:', error.message);
      throw new Error('Failed to create conversation');
    }
  },

  // Get conversation by ID
  getConversationById: async (conversation_id, user_id) => {
    const query = `
      SELECT * FROM conversations 
      WHERE id = $1 AND user_id = $2`;
    try {
      const result = await pool.query(query, [conversation_id, user_id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in getConversationById:', error.message);
      throw new Error('Failed to fetch conversation');
    }
  },

  // Get all conversations for a user
  getUserConversations: async (user_id) => {
    const query = `
      SELECT c.*, 
        (SELECT content FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at ASC 
         LIMIT 1) as first_message
      FROM conversations c
      WHERE user_id = $1
      ORDER BY favorite DESC, updated_at DESC`;
    try {
      const result = await pool.query(query, [user_id]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error in getUserConversations:', error.message);
      throw new Error('Failed to fetch conversations');
    }
  },

  // Update conversation timestamp
  updateConversationTimestamp: async (conversation_id) => {
    const query = `
      UPDATE conversations 
      SET updated_at = NOW() 
      WHERE id = $1`;
    try {
      await pool.query(query, [conversation_id]);
    } catch (error) {
      console.error('❌ Error in updateConversationTimestamp:', error.message);
    }
  },

  // Save message
  saveMessage: async (conversation_id, role, content, model = null, tokens_used = 0, detailed_content) => {
    const query = `
      INSERT INTO messages (conversation_id, role, content, model, tokens_used, detailed_content)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`;
    try {
      const result = await pool.query(query, [conversation_id, role, content, model, tokens_used,  detailed_content ? JSON.stringify(detailed_content) : null]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in saveMessage:', error.message);
      throw new Error('Failed to save message');
    }
  },


//   saveMessage: async (conversation_id, role, content, model = null, tokens_used = 0, detailed_content) => {
//   const query = `
//     INSERT INTO messages (conversation_id, role, content, model, tokens_used, detailed_content)
//     VALUES ($1, $2, $3, $4, $5, $6)
//     RETURNING *`;
//   try {
//     console.log('💾 Saving message:', {
//       conversation_id,
//       role,
//       content_length: content?.length,
//       model,
//       tokens_used,
//       has_detailed_content: !!detailed_content,
//       detailed_content_keys: detailed_content ? Object.keys(detailed_content) : null
//     });
    
//     const result = await pool.query(query, [
//       conversation_id, 
//       role, 
//       content, 
//       model, 
//       tokens_used,  
//       detailed_content ? JSON.stringify(detailed_content) : null
//     ]);
    
//     console.log('✅ Message saved successfully');
//     return result.rows[0];
//   } catch (error) {
//     console.error('❌ Error in saveMessage:', error.message);
//     console.error('❌ Error stack:', error.stack);
//     console.error('❌ Error details:', {
//       conversation_id,
//       role,
//       model,
//       tokens_used,
//       detailed_content_preview: detailed_content ? JSON.stringify(detailed_content).substring(0, 200) : null
//     });
//     throw new Error('Failed to save message: ' + error.message);
//   }
// },


  // Get conversation history (all messages)
  // getConversationHistory: async (conversation_id) => {
  //   const query = `
  //     SELECT id, role, content, model, tokens_used, created_at, detailed_content
  //     FROM messages
  //     WHERE conversation_id = $1
  //     ORDER BY created_at ASC`;
  //   try {
  //     const result = await pool.query(query, [conversation_id]);
  //     return result.rows;
  //   } catch (error) {
  //     console.error('❌ Error in getConversationHistory:', error.message);
  //     throw new Error('Failed to fetch conversation history');
  //   }
  // },

  // getConversationHistory: async (conversation_id) => {
  //   const query = `
  //     SELECT id, role, content, model, tokens_used, created_at, detailed_content
  //     FROM messages
  //     WHERE conversation_id = $1
  //     ORDER BY created_at ASC`;
  //   try {
  //     const result = await pool.query(query, [conversation_id]);

  //     // Transform rows
  //     return result.rows.map(row => {
  //       let transformed = { ...row };

  //       // If detailed_content contains places, flatten them
  //       if (row.detailed_content?.places) {
  //         transformed.places = row.detailed_content.places;
  //       }

  //       // Remove detailed_content from output
  //       delete transformed.detailed_content;

  //       return transformed;
  //     });
  //   } catch (error) {
  //     console.error('❌ Error in getConversationHistory:', error.message);
  //     throw new Error('Failed to fetch conversation history');
  //   }
  // },

  getConversationHistory: async (conversation_id) => {
  const query = `
    SELECT id, role, content, model, tokens_used, created_at, detailed_content
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC`;
  try {
    const result = await pool.query(query, [conversation_id]);

    // Transform rows
    return result.rows.map(row => {
      let transformed = { ...row };

      // If detailed_content exists, spread all its properties
      if (row.detailed_content && typeof row.detailed_content === 'object') {
        // Spread all detailed_content properties into transformed
        Object.assign(transformed, row.detailed_content);
      }

      // Remove detailed_content from output (we've already extracted it)
      delete transformed.detailed_content;

      return transformed;
    });
  } catch (error) {
    console.error('❌ Error in getConversationHistory:', error.message);
    console.error('Error stack:', error.stack);
    throw new Error('Failed to fetch conversation history');
  }
},


  // Delete conversation
  deleteConversation: async (conversation_id, user_id) => {
    const query = `
      DELETE FROM conversations 
      WHERE id = $1 AND user_id = $2
      RETURNING *`;
    try {
      const result = await pool.query(query, [conversation_id, user_id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in deleteConversation:', error.message);
      throw new Error('Failed to delete conversation');
    }
  },

  // Update conversation title
  // updateConversationTitle: async (conversation_id, user_id, title, favorite) => {
  //   const query = `
  //     UPDATE conversations 
  //     SET title = $1, favorite = $2, updated_at = NOW()
  //     WHERE id = $3 AND user_id = $4
  //     RETURNING *`;
  //   try {
  //     const result = await pool.query(query, [title, favorite, conversation_id, user_id]);
  //     return result.rows[0];
  //   } catch (error) {
  //     console.error('❌ Error in updateConversationTitle:', error.message);
  //     throw new Error('Failed to update conversation title');
  //   }
  // }
  updateConversationDetails: async (conversation_id, user_id, { title, favorite }) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;

    if (title !== undefined) {
      fields.push(`title = $${index++}`);
      values.push(title);
    }

    if (favorite !== undefined) {
      fields.push(`favorite = $${index++}`);
      values.push(favorite);
    }

    if (fields.length === 0) {
      throw new Error('No fields provided for update');
    }

    const query = `
      UPDATE conversations
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index++} AND user_id = $${index}
      RETURNING *`;

    values.push(conversation_id, user_id);

    const result = await pool.query(query, values);
    return result.rows[0];
    } catch (error) {
      console.error('❌ Error in updateConversationDetails:', error.message);
      throw new Error('Failed to update conversation details');
    }
  }

};