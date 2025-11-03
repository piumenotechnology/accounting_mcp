// src/services/ai-orchestrator.js - OPTIMIZED VERSION
import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';
import { PROMPTS, PromptDetector } from '../config/system-prompts.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
  }
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null, user_name) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Step 1: Determine which model to use
    let selectedModel;
    if (requestedModel) {
      selectedModel = requestedModel;
      console.log(`🎯 Using user-requested model: ${requestedModel}`);
    } else {
      selectedModel = this.modelSelector.selectModel(message);
      const reasoning = this.modelSelector.getModelReasoning(message);
      console.log(`🤖 Auto-selected: ${selectedModel}`);
      console.log(`   Reason: ${reasoning.reason}`);
      if (reasoning.keywords.length > 0) {
        console.log(`   Keywords detected: ${reasoning.keywords.join(', ')}`);
      }
    }
    
    const modelConfig = models[selectedModel];
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModel}`);
    }
    
    console.log(`📡 Using model: ${modelConfig.name} (${modelConfig.id})`);
    console.log(`   User: ${user_id}`);
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    if (user_location) {
      console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
    
    // Step 2: Get MCP tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Step 3: Convert MCP tools to OpenAI format
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
      user_location,
      user_name
    );
  }
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null, user_name) {
    // Detect timezone from user location
    let timezone = 'Asia/Makassar';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
    }

    // Get current time in user's timezone
    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // ═══════════════════════════════════════════════════════════════
    // 🚀 COST OPTIMIZATION: Detect what prompts are needed
    // ═══════════════════════════════════════════════════════════════
    
    const needsLocation = user_location && PromptDetector.needsLocationTools(message);
    const needsEmail = PromptDetector.needsEmailTools(message);
    const needsCalendar = PromptDetector.needsCalendarTools(message);
    
    console.log('🎯 Prompt optimization:');
    console.log(`   Location prompt: ${needsLocation ? '✅' : '❌'}`);
    console.log(`   Email prompt: ${needsEmail ? '✅' : '❌'}`);
    console.log(`   Calendar prompt: ${needsCalendar ? '✅' : '❌'}`);
    
    // ═══════════════════════════════════════════════════════════════
    // 🧩 Build modular system prompt (only include what's needed)
    // ═══════════════════════════════════════════════════════════════
    
    let systemContent = PROMPTS.BASE(timeInfo, timezone, user_name);
    
    if (needsLocation) {
      systemContent += '\n\n' + PROMPTS.LOCATION(user_location);
    }
    
    if (needsEmail) {
      systemContent += '\n\n' + PROMPTS.EMAIL(user_name);
    }
    
    if (needsCalendar) {
      systemContent += '\n\n' + PROMPTS.CALENDAR(timezone);
    }
    
    // Calculate token estimate (rough: 1 token ≈ 4 chars)
    const estimatedTokens = Math.ceil(systemContent.length / 4);
    console.log(`📝 System prompt: ${systemContent.length} chars (~${estimatedTokens} tokens)`);
    
    // ═══════════════════════════════════════════════════════════════
    // 🔧 Filter tools to only relevant ones
    // ═══════════════════════════════════════════════════════════════
    
    const relevantTools = PromptDetector.filterRelevantTools(
      tools, 
      message, 
      needsLocation, 
      needsEmail, 
      needsCalendar
    );
    
    console.log(`🔧 Tools filtered: ${relevantTools.length}/${tools.length} included`);
    console.log(`   Tools: ${relevantTools.map(t => t.function.name).join(', ')}`);
    
    // Build system message
    const systemMessage = {
      role: 'system',
      content: systemContent
    };
    
    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      messages = [systemMessage, ...conversationHistory];
      console.log(`📚 Using ${conversationHistory.length} messages from history`);
    } else {
      messages = [systemMessage, { role: 'user', content: message }];
      console.log('✨ Starting new conversation');
    }
    
    let toolsCalled = [];
    let toolResults = [];
    let maxIterations = 10; // For disambiguation + confirmation flows
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: messages,
        tools: relevantTools, // 🚀 Only pass relevant tools!
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log(`🤖 Finish reason: ${choice.finish_reason}`);
      
      // No tool calls - return final answer
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        return {
          message: choice.message.content,
          toolsCalled: toolsCalled,
          toolResults: toolResults,
          model: modelId,
          usage: response.usage
        };
      }
      
      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ Calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        let functionArgs = {};
        try {
          const argsString = toolCall.function.arguments?.trim();
          if (!argsString || argsString === '') {
            console.log('⚠️ Empty arguments, using empty object');
            functionArgs = {};
          } else {
            functionArgs = JSON.parse(argsString);
            console.log('✅ Parsed arguments:', Object.keys(functionArgs).join(', '));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse tool arguments:', parseError.message);
          console.error('   Raw arguments:', toolCall.function.arguments);
          console.error('   Tool name:', toolCall.function.name);
          functionArgs = {};
          console.log('⚠️ Using empty arguments object as fallback');
        }
        
        // Inject USER_ID for tools that need it
        const toolsRequiringUserId = [
          'create_calendar_event',
          'list_calendar_events', 
          'update_calendar_event',
          'delete_calendar_event',
          'check_google_connection',
          'search_contact',
          'send_email',
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
        }

        // Inject USER_LOCATION for location-based tools
        const toolsRequiringLocation = [
          'weather',
          'search_places',
          'get_directions',
          'get_place_details',
          'calculate_distance',
          'nearby_search'
        ];
        
        if (toolsRequiringLocation.includes(toolCall.function.name) && user_location) {
          functionArgs.user_location = user_location;
          console.log(`📍 Injected user_location for ${toolCall.function.name}`);
        }
        
        // Execute tool via MCP
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          arguments: functionArgs
        });

        // Safe result preview
        try {
          const resultText = toolResult?.content?.[0]?.text || JSON.stringify(toolResult);
          const preview = resultText.substring(0, 200);
          console.log(`✅ Tool result:`, preview + (resultText.length > 200 ? '...' : ''));
        } catch (err) {
          console.log(`✅ Tool result received (preview failed):`, err.message);
        }

        // Store tool results for structured data
        try {
          const resultText = toolResult?.content?.[0]?.text;
          if (resultText) {
            const parsedResult = JSON.parse(resultText);
            toolResults.push({
              tool: toolCall.function.name,
              data: parsedResult
            });
            console.log(`📦 Stored result from ${toolCall.function.name}`);
          }
        } catch (parseErr) {
          console.log('⚠️ Could not parse tool result for structured data');
        }
        
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
      toolResults: toolResults,
      model: modelId
    };
  }
}

export default AIOrchestrator;