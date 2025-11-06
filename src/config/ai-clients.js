// import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
// import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Claude client
// export const claudeClient = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// OpenAI client
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Gemini client
// export const geminiClient = new GoogleGenerativeAI(
//   process.env.GOOGLE_API_KEY
// );

// Check which clients are available
export const availableClients = {
  // claude: !!process.env.ANTHROPIC_API_KEY,
  openai: !!process.env.OPENAI_API_KEY,
  // gemini: !!process.env.GOOGLE_API_KEY
};

console.log('🤖 Available AI clients:', availableClients);