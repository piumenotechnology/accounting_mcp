import OpenAI from 'openai';

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY
});

export const isOpenAIConfigured = !!OPENAI_API_KEY;

// OpenAI Models
export const openaiModels = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    strengths: 'Most capable, best reasoning',
    cost: 'High',
    maxTokens: 128000
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    strengths: 'Fast and affordable',
    cost: 'Low',
    maxTokens: 128000
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    strengths: 'High capability, good balance',
    cost: 'Medium',
    maxTokens: 128000
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Turbo',
    strengths: 'Fast and cheap for simple tasks',
    cost: 'Very Low',
    maxTokens: 16385
  }
};

// OpenRouter Configuration (optional fallback)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const openRouterClient = OPENROUTER_API_KEY ? new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
}) : null;

export const isOpenRouterConfigured = !!OPENROUTER_API_KEY;

// OpenRouter Models
export const openRouterModels = {
  'claude-sonnet-4': {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    strengths: 'Excellent reasoning, long context',
    cost: 'High'
  },
  // openai: {
  //   id: 'openai/gpt-4o-mini',
  //   name: 'GPT-4o Mini',
  //   strengths: 'Creative writing, general conversation',
  //   cost: '$$',
  //   provider: 'openrouter'
  // },
  gemini: {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.0 Flash',
    strengths: 'Quick tasks, cost-effective (FREE)',
    cost: 'FREE',
    provider: 'openrouter'
  },
};

// Check if OpenRouter is configured
export const isConfigured = !!process.env.OPENROUTER_API_KEY;

if (!isConfigured) {
  console.warn('⚠️  OPENROUTER_API_KEY not configured!');
} else {
  console.log('✅ OpenRouter configured with models:', Object.keys(models).join(', '));
}