import express from 'express';
// import AIOrchestrator from '../services/ai-orchestrator.js';

import DataAnalysisOrchestrator from '../services/ai-orchestrator.js'
const orchestrator = new DataAnalysisOrchestrator()

const router = express.Router();
// const aiOrchestrator = new AIOrchestrator();

// router.post('/chat', async (req, res) => {
//   const { message, model } = req.body;
  
//   if (!message) {
//     return res.status(400).json({ error: 'Message is required' });
//   }
  
//   try {
//     console.log('📨 Received message:', message);
//     if (model) {
//       console.log('🎯 Requested specific model:', model);
//     }
    
//     const response = await aiOrchestrator.processMessage(message);
    
//     console.log('✅ Response from', response.model);
    
//     res.json({
//       message: response.message,
//       toolsCalled: response.toolsCalled,
//       model: response.model
//     });
    
//   } catch (error) {
//     console.error('❌ Error:', error);
//     res.status(500).json({ 
//       error: 'Failed to process message',
//       details: error.message 
//     });
//   }
// });

router.post('/chat', async (req, res) => {
  try {
    const { message, model } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    console.log(`\n📨 New request: "${message.substring(0, 60)}..."`);
    if (model) {
      console.log(`   Using model: ${model}`);
    }
    
    const result = await orchestrator.processMessage(message, model);
    
    console.log(`✅ Response generated (${result.toolsCalled.length} tools used)\n`);
    
    res.json({
      success: true,
      response: result.message,
      metadata: {
        model: result.model,
        toolsCalled: result.toolsCalled,
        iterations: result.iterations
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/schema/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`📋 Schema request for user: ${userId}`);
    
    const schema = await orchestrator.getSchemaInfo(userId);
    
    res.json({
      success: true,
      schema: schema
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { userId, question, model } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'question is required'
      });
    }
    
    console.log(`\n📊 Analysis request`);
    console.log(`   User: ${userId}`);
    console.log(`   Question: "${question}"`);
    
    const result = await orchestrator.analyzeData(userId, question, model);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
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