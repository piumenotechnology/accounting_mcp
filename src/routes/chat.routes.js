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

export default router;