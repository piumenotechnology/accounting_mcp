import express from 'express';
import AIOrchestrator from '../services/ai-orchestrator.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, user_id, model, provider = 'openai' } = req.body;
    
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
      model,      // optional: 'gpt-4o', 'gpt-4o-mini', etc.
      provider    // 'openai' or 'openrouter'
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

// Get available models
router.get('/models', (req, res) => {
  const { openaiModels, openRouterModels } = require('../config/ai-clients.js');
  
  res.json({
    openai: isOpenAIConfigured ? openaiModels : null,
    openrouter: isOpenRouterConfigured ? openRouterModels : null
  });
});

export default router;