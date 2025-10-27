import express from 'express';
import AIOrchestrator from '../services/ai-orchestrator.js';

const router = express.Router();

// Chat endpoint with conversation memory
router.post('/', async (req, res) => {
  try {
    const { 
      message, 
      user_id, 
      model, 
      provider = 'openai',
      conversation_id = 'default'  // Add conversation ID support
    } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const orchestrator = new AIOrchestrator();
    
    const result = await orchestrator.processMessage(
      message, 
      user_id, 
      model,
      provider,
      conversation_id  // Pass conversation ID
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ AI processing error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get conversation history
router.get('/conversation/:user_id/:conversation_id?', (req, res) => {
  const { user_id, conversation_id = 'default' } = req.params;
  
  const orchestrator = new AIOrchestrator();
  const history = orchestrator.getConversationHistory(user_id, conversation_id);
  
  res.json({
    success: true,
    conversation_id,
    history
  });
});

// Clear conversation
router.delete('/conversation/:user_id/:conversation_id?', (req, res) => {
  const { user_id, conversation_id = 'default' } = req.params;
  
  const orchestrator = new AIOrchestrator();
  orchestrator.clearConversation(user_id, conversation_id);
  
  res.json({
    success: true,
    message: 'Conversation cleared'
  });
});

// Get available models
router.get('/models', (req, res) => {
  const { openaiModels, openRouterModels, isOpenAIConfigured, isOpenRouterConfigured } = require('../config/ai-clients.js');
  
  res.json({
    openai: isOpenAIConfigured ? openaiModels : null,
    openrouter: isOpenRouterConfigured ? openRouterModels : null
  });
});

export default router;