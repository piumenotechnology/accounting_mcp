import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Single OpenRouter client for all models
export const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'MCP Backend',
  }
});

// Model configurations
export const models = {
  claude: {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    strengths: 'Complex reasoning, analysis, coding',
    cost: '$$$',
    provider: 'openrouter'
  },
  openai: {
    id: 'openai/gpt-4.1-mini',
    name: 'OpenAI GPT-4.1 Mini',
    strengths: 'Creative writing, general conversation',
    cost: '$$',
    provider: 'openrouter'
  },
  gemini: {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.0 Flash',
    strengths: 'Quick tasks',
    cost: 'FREE',
    provider: 'openrouter'
  },
  grock: {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    strengths: 'General purpose tasks',
    cost: '$',  
    provider: 'openrouter'
  }
};

// Check if OpenRouter is configured
export const isConfigured = !!process.env.OPENROUTER_API_KEY;

if (!isConfigured) {
  console.warn('⚠️  OPENROUTER_API_KEY not configured!');
} else {
  console.log('✅ OpenRouter configured with models:', Object.keys(models).join(', '));
}