import { claudeClient, openaiClient, geminiClient, availableClients } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
  }
  
  async processMessage(message) {
    // Step 1: Determine which model to use
    const selectedModel = this.modelSelector.selectModel(message);
    
    // Check if selected model is available
    if (!availableClients[selectedModel]) {
      console.warn(`⚠️ ${selectedModel} not available, falling back to available model`);
      // Fallback to first available model
      const fallbackModel = Object.keys(availableClients).find(
        model => availableClients[model]
      );
      if (!fallbackModel) {
        throw new Error('No AI models available. Please configure API keys.');
      }
      return await this.processWithModel(message, fallbackModel);
    }
    
    console.log(`🎯 Selected model: ${selectedModel}`);
    const modelInfo = this.modelSelector.getModelInfo(selectedModel);
    console.log(`   Strengths: ${modelInfo.strengths}`);
    
    return await this.processWithModel(message, selectedModel);
  }
  
  async processWithModel(message, modelName) {
    // Connect to MCP and get tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Route to appropriate model handler
    switch (modelName) {
      case 'claude':
        return await this.processWithClaude(message, mcpTools);
      case 'openai':
        return await this.processWithOpenAI(message, mcpTools);
      case 'gemini':
        return await this.processWithGemini(message, mcpTools);
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }
  
  // ============ CLAUDE ============
  async processWithClaude(message, mcpTools) {
    const claudeTools = mcpTools.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
    
    let messages = [{ role: 'user', content: message }];
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Claude Iteration ${iteration + 1}`);
      
      const response = await claudeClient.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: messages,
        tools: claudeTools
      });
      
      console.log('🤖 Claude stop_reason:', response.stop_reason);
      
      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find(c => c.type === 'text');
        return {
          message: textContent?.text || 'No response',
          toolsCalled: toolsCalled,
          model: 'claude-sonnet-4-5'
        };
      }
      
      if (response.stop_reason === 'tool_use') {
        const toolUse = response.content.find(c => c.type === 'tool_use');
        
        console.log(`⚡ Claude calling tool: ${toolUse.name}`, toolUse.input);
        toolsCalled.push(toolUse.name);
        
        const toolResult = await this.mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input
        });
        
        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult.content)
          }]
        });
        
        continue;
      }
      
      break;
    }
    
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      model: 'claude-sonnet-4-5'
    };
  }
  
  // ============ OPENAI ============
  async processWithOpenAI(message, mcpTools) {
    // Convert MCP tools to OpenAI function format
    const openaiTools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    let messages = [{ role: 'user', content: message }];
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 OpenAI Iteration ${iteration + 1}`);
      
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: openaiTools,
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log('🤖 OpenAI finish_reason:', choice.finish_reason);
      
      if (choice.finish_reason === 'stop') {
        return {
          message: choice.message.content,
          toolsCalled: toolsCalled,
          model: 'gpt-4o-mini'
        };
      }
      
      if (choice.finish_reason === 'tool_calls') {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ OpenAI calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          arguments: functionArgs
        });
        
        messages.push(choice.message);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.content)
        });
        
        continue;
      }
      
      break;
    }
    
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      model: 'gpt-4o-mini'
    };
  }
  
  // ============ GEMINI ============
  async processWithGemini(message, mcpTools) {
    const model = geminiClient.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });
    
    // Convert MCP tools to Gemini function format
    const geminiFunctions = mcpTools.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
    
    let chat = model.startChat({
      tools: [{ functionDeclarations: geminiFunctions }],
      history: []
    });
    
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Gemini Iteration ${iteration + 1}`);
      
      const result = await chat.sendMessage(message);
      const response = result.response;
      
      // Check for function calls
      const functionCalls = response.functionCalls();
      
      if (!functionCalls || functionCalls.length === 0) {
        // No function calls, return text response
        return {
          message: response.text(),
          toolsCalled: toolsCalled,
          model: 'gemini-2.0-flash'
        };
      }
      
      // Execute function calls
      for (const functionCall of functionCalls) {
        console.log(`⚡ Gemini calling tool: ${functionCall.name}`, functionCall.args);
        toolsCalled.push(functionCall.name);
        
        const toolResult = await this.mcpClient.callTool({
          name: functionCall.name,
          arguments: functionCall.args
        });
        
        // Send function response back to Gemini
        const functionResponse = {
          functionResponse: {
            name: functionCall.name,
            response: toolResult.content[0]
          }
        };
        
        // Continue chat with function result
        const nextResult = await chat.sendMessage([functionResponse]);
        
        // If this is the last iteration, return response
        if (iteration === maxIterations - 1) {
          return {
            message: nextResult.response.text(),
            toolsCalled: toolsCalled,
            model: 'gemini-2.0-flash'
          };
        }
        
        // Check if Gemini wants to call more functions
        if (!nextResult.response.functionCalls()) {
          return {
            message: nextResult.response.text(),
            toolsCalled: toolsCalled,
            model: 'gemini-2.0-flash'
          };
        }
      }
    }
    
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      model: 'gemini-2.0-flash'
    };
  }
}

export default AIOrchestrator;