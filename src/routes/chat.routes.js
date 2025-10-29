import express from 'express';
import { chatModels } from '../models/chat.model.js';
import { authModels } from '../models/user.models.js'
import AIOrchestrator from '../services/ai-orchestrator.js'; // Adjust path

const router = express.Router();
const aiOrchestrator = new AIOrchestrator();

// POST /api/chat - Send message and get AI response WITH MEMORY
router.post('/', async (req, res) => {
  try {
    const { message, model, user_id, chat_id, user_location } = req.body;

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
    if (user_location) {
      console.log('📍 User location:', user_location);
    }

    let conversationId = chat_id;
    let conversationHistory = [];

    // If chat_id provided, get existing conversation
    if (conversationId) {
      const conversation = await chatModels.getConversationById(conversationId, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Get conversation history from database
      const historyFromDB = await chatModels.getConversationHistory(conversationId);
      
      // Format history for AI (only role and content)
      conversationHistory = historyFromDB.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      console.log(`💬 Loaded ${conversationHistory.length} previous messages`);
    } else {
      // Create new conversation
      const selectedModel = model || 'gemini';
      const newConversation = await chatModels.createConversation(user_id, selectedModel);
      conversationId = newConversation.id;
      console.log('✨ Created new conversation:', conversationId);
    }

    // Save current user message to database
    await chatModels.saveMessage(conversationId, 'user', message);

    // Add current message to history for AI
    conversationHistory.push({
      role: 'user',
      content: message
    });

    const user = await authModels.getUserByid(user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Call AI Orchestrator with full conversation history + location
    console.log('🤖 Processing with AI Orchestrator...');
    const response = await aiOrchestrator.processMessage(
      message, 
      user_id, 
      model,
      conversationHistory,
      user_location,
      user.name
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
router.patch('/:chat_id/details', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id, title, favorite } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const updated = await chatModels.updateConversationDetails(chat_id, user_id, { title, favorite });

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error('❌ Error updating conversation details:', error.message);
    res.status(500).json({ error: 'Failed to update conversation details' });
  }
});



export default router;