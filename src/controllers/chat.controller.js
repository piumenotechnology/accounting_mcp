import express from 'express';
import { chatModels } from '../models/chatModels.js';

const router = express.Router();

// POST /api/chat - Send message and get AI response
router.post('/', async (req, res) => {
  try {
    const { message, model, user_id, chat_id } = req.body;

    // Validate input
    if (!message || !model || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: message, model, user_id' 
      });
    }

    let conversationId = chat_id;

    // Create new conversation if chat_id is not provided
    if (!conversationId) {
      const newConversation = await chatModels.createConversation(user_id, model);
      conversationId = newConversation.id;
    } else {
      // Verify conversation belongs to user
      const conversation = await chatModels.getConversationById(conversationId, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    }

    // Save user message
    await chatModels.saveMessage(conversationId, 'user', message);

    // Get conversation history
    const history = await chatModels.getConversationHistory(conversationId);

    // Format messages for AI (OpenRouter format)
    const formattedMessages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // TODO: Call OpenRouter API here with formattedMessages
    // For now, mock response
    const aiResponse = {
      content: "This is a mock AI response. Integrate OpenRouter here.",
      model: model,
      tokens: 50
    };

    // Save AI response
    await chatModels.saveMessage(
      conversationId, 
      'assistant', 
      aiResponse.content, 
      model, 
      aiResponse.tokens
    );

    // Update conversation timestamp
    await chatModels.updateConversationTimestamp(conversationId);

    res.json({
      success: true,
      conversation_id: conversationId,
      message: aiResponse.content,
      model: model
    });

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// GET /api/chat/conversations - Get all user conversations
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