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
  'gpt-4-turbo': {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    strengths: 'High capability, good balance',
    cost: 'Medium',
    maxTokens: 128000
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
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
  'claude-3.5-sonnet': {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    strengths: 'Great balance of speed and capability',
    cost: 'Medium'
  },
  'gemini-2-flash': {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    strengths: 'Very fast, free tier available',
    cost: 'Free/Low'
  }
};