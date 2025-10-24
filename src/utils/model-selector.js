import { models } from '../config/ai-clients.js';

/**
 * Determines which AI model to use based on the message content
 */
export class ModelSelector {
  
  selectModel(message) {
    const lowerMessage = message.toLowerCase();
    
    // Use Claude for complex reasoning, analysis, coding
    if (this.containsKeywords(lowerMessage, [
      'analyze', 'complex', 'reasoning', 'explain', 'code', 
      'programming', 'debug', 'algorithm', 'logic', 'compare'
    ])) {
      return 'claude';
    }
    
    // Use GPT-4 for creative writing, storytelling
    if (this.containsKeywords(lowerMessage, [
      'write', 'creative', 'story', 'poem', 'essay', 
      'article', 'blog', 'imagine', 'create content'
    ])) {
      return 'gpt4';
    }
    
    // Use Gemini for quick tasks, simple queries (FREE!)
    if (this.containsKeywords(lowerMessage, [
      'count', 'calculate', 'simple', 'quick', 'what is',
      'how many', 'list', 'summarize', 'add', 'multiply'
    ])) {
      return 'gemini';
    }
    
    // Default to Gemini (FREE)
    return 'gemini';
  }
  
  containsKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }
  
  getModelInfo(modelName) {
    return models[modelName] || models.gemini;
  }
  
  // Get all available models
  getAllModels() {
    return models;
  }
}