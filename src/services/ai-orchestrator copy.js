// src/services/ai-orchestrator.js - COMPLETE WITH ALL FEATURES
import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';
import DatabaseService from './database.service.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
    this.schemaCache = new Map();
    this.dbService = DatabaseService;
  }

  // Add/update this in AIOrchestrator class:

  async getDatabaseContext(user_id) {
    try {
      const schemaInfo = await this.dbService.getCompleteSchemaInfo(user_id);
      
      if (!schemaInfo || !schemaInfo.tables || schemaInfo.tables.length === 0) {
        return null;
      }
      
      // Format for our use
      return {
        schemas: [{
          schema_name: schemaInfo.schema_name,
          client_name: schemaInfo.client_name,
          referral: schemaInfo.referral
        }],
        structures: {
          [schemaInfo.schema_name]: schemaInfo.tables
        },
        available_fields: schemaInfo.available_fields || [] // INCLUDES PRE-CONFIGURED FIELDS
      };
      
    } catch (error) {
      // console.error('❌ Failed to get database context:');
      return null;
    }
  }

  formatDatabaseWithSamples(dbContext, samples) {
    let output = 'AVAILABLE TABLES WITH SAMPLE DATA:\n';
    
    for (const schema of dbContext.schemas) {
      const structure = dbContext.structures[schema.schema_name];
      
      for (const table of structure) {
        output += `\nTable: ${table.name}\n`;
        output += `Columns: ${table.columns.map(c => `${c.name} (${c.type})`).join(', ')}\n`;
        
        const sampleData = samples[table.name] || [];
        output += `Sample Data:\n${sampleData.length > 0 ? JSON.stringify(sampleData, null, 2) : 'No samples'}\n`;
      }
    }
    
    return output;
  }

  /**
   * Build comprehensive system message with all features
   */
  async buildSystemMessage(user_id, user_name, user_location, timezone, timeInfo) {
    let systemContent = `Current date and time:
    - Date: ${timeInfo.localDate}
    - Time: ${timeInfo.localTime}
    - Timezone: ${timezone}

    User: ${user_name}

    You are a helpful AI assistant with access to various tools.
    Use tools when needed to provide accurate, helpful responses.`;

    // Only add location context if user has location
    if (user_location && user_location.lat && user_location.lng) {
      systemContent += `
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      USER LOCATION AVAILABLE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Location: ${user_location.lat}, ${user_location.lng}

      For location-based queries, use these coordinates automatically.
      Don't ask "where are you?" - the location is provided above.
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    // Only add database context if user has database access
    const dbContext = await this.getDatabaseContext(user_id);

    if (dbContext && dbContext.schemas.length > 0) {
      const samples = await this.dbService.getTableSamples(user_id, 3);
      
      systemContent += `

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    DATABASE ANALYTICS (AUTO-EXECUTION)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    CLIENT: ${dbContext.schemas[0].client_name}
    SCHEMA: ${dbContext.schemas[0].schema_name}

    ${this.formatDatabaseWithSamples(dbContext, samples)}`;

    // ADD PRE-CONFIGURED FIELDS SECTION
    if (dbContext.available_fields && dbContext.available_fields.length > 0) {
      systemContent += `
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRE-CONFIGURED FIELDS (Complex Queries)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        These fields have pre-built queries with correct formulas and JOINs.
        ⚠️ THESE ARE NOT COLUMNS - they are calculated fields!

        ${dbContext.available_fields.map(field => `
        - ${field.name}
          Description: ${field.description}
          Source: ${field.source_table}
          
          To use this field:
          1. Call get_field_query(field_name: "${field.name}")
          2. You'll receive the base query with correct formula
          3. Add user's filters (WHERE, etc.)
          4. Execute with execute_query
          
          ❌ DO NOT try to query a column called "${field.name}"
          ✅ DO use get_field_query first!
        `).join('\n')}
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    systemContent += `
      AVAILABLE TOOLS:
      1. get_field_query - Get pre-built query for fields listed above
      2. execute_query - Execute SQL query on database

      QUERY WORKFLOW:

      For PRE-CONFIGURED FIELDS:
      User: "What's the total income for vehicle HV71?"
      Step 1: get_field_query(field_name: "total_income")
              → Returns base query with correct formula
      Step 2: Add filter: WHERE vehicle_rego = 'HV71'
      Step 3: execute_query(schema_name, modified_query, params)
              → Get results

      For REGULAR TABLE QUERIES:
      User: "Show me all payments from John"
      Step 1: execute_query directly
              → SELECT * FROM payment_xero WHERE contact_name ILIKE $1

      EXECUTION:
      - Only SELECT allowed (read-only, safe)
      - Execute immediately - no confirmation needed
      - LIMIT auto-added by system

      SMART QUERY BUILDING:
      1. Identify if field is pre-configured → use get_field_query
      2. Use exact column names from tables above
      3. Text filters: WHERE name ILIKE $1 → params: ['%john%']
      4. Aggregations: SUM(), COUNT(), AVG() with GROUP BY
      5. Execute immediately, answer user

      Execute queries autonomously using schema and samples above.
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

    // Google Tools Workflow
    systemContent += `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GOOGLE TOOLS WORKFLOW
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    CONTACT DISAMBIGUATION:
    When search_contact returns requiresDisambiguation: true:
    1. Show numbered list:
      "I found [X] people named '[name]':
      1. [Full Name] ([email])
      2. [Full Name] ([email])
      Which one?"

    2. Wait for selection: "1", "2", "first one", or actual name
    3. Remember the ORIGINAL action (email/calendar) and continue with it

    When search_contact returns noCloseMatch: true:
    "No close match for '[name]'. Did you mean:
    - [Suggestion 1]
    - [Suggestion 2]
    Or provide their email directly."

    Wait for clarification before proceeding.

    ACTION CONFIRMATION (Required before execution):
    Before create_calendar_event:
    "I'll create a meeting with [Name]:
    - [Day] at [Time]
    - [Duration/Topic]
    Should I create it?"

    Before send_email:
    "I'll send this to [Name] ([email]):
    [Brief preview of content]
    Should I send it?"

    Wait for confirmation: yes/ok/sure/go ahead/send it/create it
    Do not proceed on: no/wait/cancel/stop/not yet

    If user wants changes, ask what to modify, show updated preview, confirm again.

    Before delete_calendar_event:
    "Delete [Event Name] on [Date]? This can't be undone."

    CALENDAR EVENT DETAILS:
    - Use timezone: ${timezone}
    - Format: ISO 8601 (YYYY-MM-DDTHH:mm:ss)
    - Current date: ${timeInfo.localDate}
    - Calculate relative times from current date/time

    EMAIL SIGNATURE:
    Always sign emails:
    "Best regards,
    ${user_name}"

    Never use "[Your Name]" or placeholders.

    READ-ONLY OPERATIONS (No confirmation needed):
    - search_contact (just searching)
    - list_calendar_events (just listing)
    - check_google_connection (status check)

    Execute these immediately without confirmation.

    FLOW TRACKING:
    - Remember user's original intent (email vs calendar vs delete)
    - When user selects "1" or "2" after contact list → continue original action
    - Don't switch action types mid-conversation

    Example:
    User: "Create meeting with fitrah tomorrow"
    → search_contact finds 3 matches
    → Show numbered list
    User: "1"
    → Create CALENDAR EVENT with selected contact (not email!)
    → Show event preview, wait for confirmation
    User: "yes"
    → Execute create_calendar_event
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Maps & Location Tools
    systemContent += `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    MAPS & LOCATION TOOLS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ${user_location ? `✅ USER LOCATION: ${user_location.lat}, ${user_location.lng}
    Location is auto-injected for all maps tools - just call them.` : '⚠️ No location available - ask user if needed for maps queries'}
    CRITICAL - USE SPECIFIC QUERIES:
    ❌ WRONG: query: "gym" → returns stores selling equipment
    ✅ CORRECT: query: "fitness center gym" → returns actual gyms

    Examples:
    - "fitness center gym" → gyms
    - "coffee shop cafe" → coffee shops
    - "italian restaurant" → restaurants
    - "24-hour pharmacy" → pharmacies

    TOOLS:
    1. search_places - Find places by type/name
    2. get_directions - Route with traffic and ETA
    3. get_place_details - Hours, phone, reviews for specific place
    4. calculate_distance - Quick distance/time between points
    5. nearby_search - Discover top-rated places

    RESPONSE FORMAT:
    Keep responses BRIEF - structured data is returned separately.
    ✅ "Found 5 gyms near you. Want details on any?"
    ❌ Don't list all details (it's in the structured data already)

    For place details: User asks "tell me about #2" → call get_place_details
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Web Search & News
    systemContent += `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    WEB SEARCH & NEWS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    WHEN TO SEARCH:
    - Current events, news, recent information
    - Real-time data (prices, rates, scores, weather beyond local)
    - Information beyond knowledge cutoff
    - User explicitly asks to "search" or "look up"
    - Verification of facts or recent developments

    TOOLS:
    1. web_search - General internet search (returns AI summary + sources)
    2. news_search - Recent news articles (specify days: 1-30)
    3. deep_search - Comprehensive research (more detailed results)

    TOOL SELECTION:
    - User asks "search for..." or "look up..." → web_search
    - User asks "latest news" or "recent..." → news_search
    - User asks "research..." or "detailed analysis" → deep_search

    RESPONSE FORMAT:
    Synthesize information naturally, mention sources.
    ✅ "According to recent reports, [information]..."
    ✅ "Based on search results, [finding]..."
    ❌ Don't copy-paste long excerpts
    ❌ Don't just list URLs

    Keep responses concise and directly answer the query.
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        // Final tool usage section
    systemContent += `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TOOL USAGE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Choose the right tools based on the user's question.
    Execute autonomously when appropriate (database queries, searches, read-only operations).
    Ask confirmation when needed (emails, calendar events, deletions).`;

    return systemContent;
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
    // console.log(`   User: ${user_id}`);
    // console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    if (user_location) {
      // console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
    
    // Step 2: Get MCP tools - ALL OF THEM
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    // console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Step 3: Convert MCP tools to OpenAI format - PASS ALL TOOLS
    const tools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    // Step 4: Process with OpenRouter
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

    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // Build comprehensive system message
    const systemContent = await this.buildSystemMessage(
      user_id, 
      user_name, 
      user_location, 
      timezone, 
      timeInfo
    );

    console.log("sytem content", systemContent)
    
    const estimatedTokens = Math.ceil(systemContent.length / 4);
    console.log(`📝 System prompt: ${systemContent.length} chars (~${estimatedTokens} tokens)`);
    
    // Build system message
    const systemMessage = {
      role: 'system',
      content: systemContent
    };
    
    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      messages = [systemMessage, ...conversationHistory];
      // console.log(`📚 Using ${conversationHistory.length} messages from history`);
    } else {
      messages = [systemMessage, { role: 'user', content: message }];
      console.log('✨ Starting new conversation');
    }
    
    let toolsCalled = [];
    let toolResults = [];
    let maxIterations = 10;
    
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

      if (choice.message.tool_calls) {
        console.log(`🔧 AI chose tools:`, choice.message.tool_calls.map(t => t.function.name));
      }
      
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
          'execute_query',
          'get_field_query', //new 
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
          
          if (toolCall.function.name === 'execute_query') {
            functionArgs.user_message = message;
          }
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

        let toolResultContent;
  
        if (toolResult.content && Array.isArray(toolResult.content)) {
          toolResultContent = toolResult.content[0]?.text || JSON.stringify(toolResult.content);
        } else if (typeof toolResult === 'string') {
          toolResultContent = toolResult;
        } else {
          toolResultContent = JSON.stringify(toolResult);
        }
        
        console.log(`📤 Sending tool result (${toolResultContent.length} chars)`);

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments
            }
          }]
        });
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResultContent
        });

        try {
          const parsedResult = JSON.parse(toolResultContent);
          toolResults.push({
            tool: toolCall.function.name,
            data: parsedResult
          });
        } catch (parseErr) {
          console.log('⚠️ Could not parse tool result for structured data');
        }
        
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