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

    // Call AI Orchestrator with full conversation history + location
    console.log('🤖 Processing with AI Orchestrator...');
    const response = await aiOrchestrator.processMessage(
      message, 
      user_id, 
      model,
      conversationHistory,
      user_location // ⭐ Pass location
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

// ... rest of your routes (conversations, history, delete, update title)

export default router;