// export class ModelSelector {
//   selectModel(message, provider = 'openai') {
//     const lowercaseMsg = message.toLowerCase();
    
//     if (provider === 'openai') {
//       // Complex reasoning tasks
//       if (this.isComplexTask(lowercaseMsg)) {
//         return 'gpt-4o';
//       }
      
//       // Fast, simple tasks
//       if (this.isSimpleTask(lowercaseMsg)) {
//         return 'gpt-4.1-mini';
//       }

//       if (this.isSimpleTask(lowercaseMsg)) {
//         return 'gpt-5-mini';
//       }
      
//       // Default: balanced model
//       return 'gpt-4o-mini';
//     } else {
//       // OpenRouter defaults
//       if (this.isComplexTask(lowercaseMsg)) {
//         return 'claude-sonnet-4';
//       }
//       return 'claude-3.5-sonnet';
//     }
//   }
  
//   isComplexTask(message) {
//     const complexKeywords = [
//       'analyze', 'compare', 'evaluate', 'complex', 
//       'detailed', 'comprehensive', 'explain in detail'
//     ];
//     return complexKeywords.some(keyword => message.includes(keyword));
//   }
  
//   isSimpleTask(message) {
//     const simpleKeywords = [
//       'what is', 'list', 'count', 'simple', 
//       'quick', 'weather', 'time'
//     ];
//     return simpleKeywords.some(keyword => message.includes(keyword));
//   }
// }


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