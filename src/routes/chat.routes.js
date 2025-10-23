import express from 'express';
import AIOrchestrator from '../services/ai-orchestrator.js';

const router = express.Router();
const aiOrchestrator = new AIOrchestrator();

router.post('/chat', async (req, res) => {
  const { message, model } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    console.log('📨 Received message:', message);
    if (model) {
      console.log('🎯 Requested specific model:', model);
    }
    
    const response = await aiOrchestrator.processMessage(message);
    
    console.log('✅ Response from', response.model);
    
    res.json({
      message: response.message,
      toolsCalled: response.toolsCalled,
      model: response.model
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

// New endpoint: Get available models
router.get('/models', (req, res) => {
  import('../config/ai-clients.js').then(({ availableClients }) => {
    res.json({
      available: availableClients,
      models: {
        claude: 'Claude Sonnet 4.5 - Complex reasoning, analysis, coding',
        openai: 'GPT-4 Turbo - Creative writing, general conversation',
        gemini: 'Gemini 2.0 Flash - Quick tasks, cost-effective'
      }
    });
  });
});

export default router;