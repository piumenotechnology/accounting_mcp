// //router
// import express from 'express';
// import AIOrchestrator from '../services/ai-orchestrator.js';
// import { models } from '../config/ai-clients.js';
// import {requireAuth} from '../middlewares/auth.js';

// const router = express.Router();
// const aiOrchestrator = new AIOrchestrator();

// router.post('/', async (req, res) => {
//   const { message, model, user_id, chat_id } = req.body;
//   // const user_id = req.user.id;
  
//   if (!message) {
//     return res.status(400).json({ error: 'Message is required' });
//   }
  
//   try {
//     console.log('📨 Received message:', message);
//     if (model) {
//       console.log('🎯 Requested specific model:', model);
//     }
    
//     const response = await aiOrchestrator.processMessage(message, user_id, model);
    
//     console.log('✅ Response completed');
    
//     res.json({
//       message: response.message,
//       toolsCalled: response.toolsCalled,
//       model: response.model,
//       usage: response.usage
//     });
    
//   } catch (error) {
//     console.error('❌ Error:', error);
//     res.status(500).json({ 
//       error: 'Failed to process message',
//       details: error.message 
//     });
//   }
// });

// // Get available models
// router.get('/models', (req, res) => {
//   res.json({
//     models: Object.entries(models).map(([key, config]) => ({
//       id: key,
//       name: config.name,
//       modelId: config.id,
//       strengths: config.strengths,
//       cost: config.cost
//     }))
//   });
// });

// export default router;

import express from 'express';
import { chatModels } from '../models/chat.model.js';
import AIOrchestrator from '../services/ai-orchestrator.js'; // Adjust path as needed

const router = express.Router();
const aiOrchestrator = new AIOrchestrator();

// POST /api/chat - Send message and get AI response WITH MEMORY
router.post('/', async (req, res) => {
  try {
    const { message, model, user_id, chat_id } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('📨 Received message:', message);
    if (model) {
      console.log('🎯 Requested specific model:', model);
    }

    let conversationId = chat_id;
    let conversationHistory = [];

    // If chat_id provided, get existing conversation
    if (conversationId) {
      const conversation = await chatModels.getConversationById(conversationId, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Get conversation history
      conversationHistory = await chatModels.getConversationHistory(conversationId);
      console.log(`💬 Loaded ${conversationHistory.length} previous messages`);
    } else {
      // Create new conversation
      const selectedModel = model || 'claude-3-5-sonnet'; // Default model
      const newConversation = await chatModels.createConversation(user_id, selectedModel);
      conversationId = newConversation.id;
      console.log('✨ Created new conversation:', conversationId);
    }

    // Save user message to database
    await chatModels.saveMessage(conversationId, 'user', message);

    // Format history for AI (only role and content)
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add current user message to history
    formattedHistory.push({
      role: 'user',
      content: message
    });

    // Call AI Orchestrator with conversation history
    console.log('🤖 Processing with AI Orchestrator...');
    const response = await aiOrchestrator.processMessage(
      message, 
      user_id, 
      model,
      formattedHistory // Pass history to orchestrator
    );

    console.log('✅ Response completed');

    // Save AI response to database
    await chatModels.saveMessage(
      conversationId,
      'assistant',
      response.message,
      response.model,
      response.usage?.total_tokens || 0
    );

    // Update conversation timestamp
    await chatModels.updateConversationTimestamp(conversationId);

    // Return response with conversation_id
    res.json({
      conversation_id: conversationId,
      message: response.message,
      toolsCalled: response.toolsCalled,
      model: response.model,
      usage: response.usage
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
});

// GET /api/chat/conversations/:user_id - Get all user conversations
router.get('/conversations/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const conversations = await chatModels.getUserConversations(user_id);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/chat/history/:chat_id - Get conversation history
router.get('/history/:chat_id', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Verify ownership
    const conversation = await chatModels.getConversationById(chat_id, user_id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const history = await chatModels.getConversationHistory(chat_id);
    res.json({ success: true, history });
  } catch (error) {
    console.error('❌ Error fetching history:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// DELETE /api/chat/:chat_id - Delete conversation
router.delete('/:chat_id', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const deleted = await chatModels.deleteConversation(chat_id, user_id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('❌ Error deleting conversation:', error.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// PATCH /api/chat/:chat_id/title - Update conversation title
router.patch('/:chat_id/title', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id, title } = req.body;

    if (!user_id || !title) {
      return res.status(400).json({ error: 'user_id and title are required' });
    }

    const updated = await chatModels.updateConversationTitle(chat_id, user_id, title);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error('❌ Error updating title:', error.message);
    res.status(500).json({ error: 'Failed to update title' });
  }
});

export default router;