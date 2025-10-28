import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
  }
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Determine provider and validate configuration
    if (provider === 'openai' && !isOpenAIConfigured) {
      if (isOpenRouterConfigured) {
        console.log('⚠️ OpenAI not configured, falling back to OpenRouter');
        provider = 'openrouter';
      } else {
        throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY');
      }
    }
    
    if (provider === 'openrouter' && !isOpenRouterConfigured) {
      if (isOpenAIConfigured) {
        console.log('⚠️ OpenRouter not configured, falling back to OpenAI');
        provider = 'openai';
      } else {
        throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY');
      }
    }
    
    // Select client and models based on provider
    const client = provider === 'openai' ? openaiClient : openRouterClient;
    const models = provider === 'openai' ? openaiModels : openRouterModels;
    
    // Determine which model to use
    const selectedModel = requestedModel || this.getDefaultModel(provider);
    const modelConfig = models[selectedModel];
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModel} for provider: ${provider}`);
    }
    
    console.log(`🎯 Provider: ${provider.toUpperCase()}`);
    console.log(`🎯 Model: ${modelConfig.name} (${modelConfig.id})`);
    console.log(`   User: ${user_id}`);
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    if (user_location) {
      console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
    
    // Get MCP tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Convert MCP tools to OpenAI format
    const tools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    // Step 4: Process with OpenRouter (pass location)
    return await this.processWithOpenRouter(
      message, 
      user_id, 
      modelConfig.id, 
      tools, 
      conversationHistory,
      user_location // ⭐ Pass location
    );
  }
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null) {
    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      messages = [...conversationHistory];
      console.log(`📚 Using ${messages.length} messages from history`);
    } else {
      messages = [{ role: 'user', content: message }];
      console.log('✨ Starting new conversation');
    }
    
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      const response = await client.chat.completions.create({
        model: modelId,
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log(`🤖 Finish reason: ${choice.finish_reason}`);
      
      // No tool calls - return final answer
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        return {
          message: choice.message.content,
          toolsCalled: toolsCalled,
          model: modelId,
          provider: provider,
          usage: response.usage
        };
      }
      
      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ Calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // Inject user_id for tools that require it
        const toolsRequiringUserId = [
          'create_calendar_event',
          'list_calendar_events', 
          'update_calendar_event',
          'delete_calendar_event',
          'check_google_connection'
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
        }

        // ⭐ INJECT USER_LOCATION for location-based tools
        const toolsRequiringLocation = [
          'weather',
          'nearby_places',
          'local_search'
          // Add more tools that need location
        ];
        
        if (toolsRequiringLocation.includes(toolCall.function.name) && user_location) {
          functionArgs.user_location = user_location;
        }
        
        // Execute tool via MCP
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          arguments: functionArgs
        });
        
        console.log(`✅ Tool result:`, toolResult.content[0].text.substring(0, 100) + '...');
        
        // Add assistant message with tool call
        messages.push(choice.message);
        
        // Add tool result
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
      model: modelId,
      provider: provider
    };
  }
}

export default AIOrchestrator;