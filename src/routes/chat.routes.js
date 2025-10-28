import express from 'express';
import AIOrchestrator from '../services/ai-orchestrator.js';
import { models } from '../config/ai-clients.js';
import {requireAuth} from '../middlewares/auth.js';

const router = express.Router();
const aiOrchestrator = new AIOrchestrator();

router.post('/', async (req, res) => {
  const { message, model, user_id, chat_id } = req.body;
  // const user_id = req.user.id;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    console.log('📨 Received message:', message);
    if (model) {
      console.log('🎯 Requested specific model:', model);
    }
    
    const response = await aiOrchestrator.processMessage(message, user_id, model);
    
    console.log('✅ Response completed');
    
    res.json({
      message: response.message,
      toolsCalled: response.toolsCalled,
      model: response.model,
      usage: response.usage
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

// Get available models
router.get('/models', (req, res) => {
  res.json({
    models: Object.entries(models).map(([key, config]) => ({
      id: key,
      name: config.name,
      modelId: config.id,
      strengths: config.strengths,
      cost: config.cost
    }))
  });
});

export default router;