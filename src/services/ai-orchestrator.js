import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
  }
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Step 1: Determine which model to use
    const selectedModel = requestedModel || this.modelSelector.selectModel(message);
    const modelConfig = models[selectedModel];
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModel}`);
    }
    
    console.log(`🎯 Selected model: ${modelConfig.name} (${modelConfig.id})`);
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
      user_location
    );
  }
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null) {
    // Detect timezone from user location
    let timezone = 'Asia/Makassar'; // Default
    let locationInfo = '';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
      locationInfo = `\nUser coordinates: ${user_location.lat}, ${user_location.lng}`;
    }

    // Get current time in user's timezone
    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // Build system message with timezone-aware info
    const systemMessage = {
      role: 'system',
      content: `Current date and time information:
- Date: ${timeInfo.localDate}
- Time: ${timeInfo.localTime}
- Timezone: ${timezone}
- ISO format: ${timeInfo.iso}${locationInfo}

Important for calendar events:
- Always use timezone: ${timezone}
- Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss
- When user says "tomorrow at 2pm", calculate based on ${timeInfo.localDate}

When user mentions relative times, calculate from the current date/time above.

Contact and Email Guidelines:
- When user mentions a person's name for calendar events or emails, use the search_contact tool to find their email address
- Wait for the contact search result before creating events or sending emails
- For emails: write professional, clear, and context-appropriate content
- Adjust tone based on context (formal for business, casual for team/friends)
- Emails are sent immediately - ensure content is accurate and appropriate
- Always include proper greeting and closing in emails`
    };

    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      // Add system message at the start, then history
      messages = [systemMessage, ...conversationHistory];
      console.log(`📚 Using ${conversationHistory.length} messages from history`);
    } else {
      // New conversation
      messages = [systemMessage, { role: 'user', content: message }];
      console.log('✨ Starting new conversation');
    }
    
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      const response = await this.client.chat.completions.create({
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
          usage: response.usage
        };
      }
      
      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ Calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // ⭐ INJECT USER_ID for tools that need it
        const toolsRequiringUserId = [
          'create_calendar_event',
          'list_calendar_events', 
          'update_calendar_event',
          'delete_calendar_event',
          'check_google_connection',
          'search_contact',
          'send_email' 
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
        }

        // ⭐ INJECT USER_LOCATION for location-based tools
        const toolsRequiringLocation = [
          'weather',
          'nearby_places',
          'local_search'
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
      model: modelId
    };
  }
}

export default AIOrchestrator;