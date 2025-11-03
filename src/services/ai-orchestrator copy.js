// src/services/ai-orchestrator.js
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
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null, user_name ) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Step 1: Determine which model to use
    let selectedModel;
    if (requestedModel) {
      // User explicitly requested a model
      selectedModel = requestedModel;
      console.log(`🎯 Using user-requested model: ${requestedModel}`);
    } else {
      // Auto-select based on query type
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
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null, user_name ) {
    // Detect timezone from user location
    let timezone = 'Asia/Makassar';
    let locationInfo = '';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
      locationInfo = `\nUser coordinates: ${user_location.lat}, ${user_location.lng}`;
    }

    // Get current time in user's timezone
    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // Build system message with confirmation rules
    const systemMessage = {
      role: 'system',
      content: `${user_location ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL: USER LOCATION IS AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Location: ${user_location.lat}, ${user_location.lng}

For ANY location/maps query, use these coordinates as origin/starting point.
❌ NEVER ask: "Where are you?", "What's your starting point?", "I need your location"
✅ ALWAYS use the coordinates above automatically

EXAMPLES OF CORRECT USAGE:
• User: "how do I get to airport?" 
  → Call: get_directions(origin: user_location, destination: "airport")
  
• User: "how far is the stadium?"
  → Call: calculate_distance(origin: user_location, destination: "stadium")
  
• User: "find gyms near me"
  → Call: search_places(location: user_location, query: "gym")

• User: "how long to Ubud?"
  → Call: get_directions(origin: user_location, destination: "Ubud")

DO NOT respond with "I need your starting point" - USE THE LOCATION ABOVE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}Current date and time information:
- Date: ${timeInfo.localDate}
- Time: ${timeInfo.localTime}
- Timezone: ${timezone}
- ISO format: ${timeInfo.iso}${locationInfo}

USER INFORMATION:
- User name: ${user_name}

EMAIL SIGNATURE:
When sending emails, ALWAYS sign with the user's name:
"Best regards,
${user_name}"

NEVER use "[Your Name]" or placeholder text.
ALWAYS use the actual user name above.

═══════════════════════════════════════════════════════════════
DATABASE QUERYING - MANDATORY WORKFLOW (CRITICAL!)
═══════════════════════════════════════════════════════════════

🚨 CRITICAL: NEVER GUESS TABLE OR COLUMN NAMES!
Always discover structure first, then write queries.

MANDATORY 3-STEP PROCESS:

┌─────────────────────────────────────────────────────────────┐
│ STEP 1: DISCOVER AVAILABLE DATA SOURCES                     │
└─────────────────────────────────────────────────────────────┘

When user asks about:
• "revenue", "sales", "income"
• "expenses", "costs", "spending"  
• "profit", "loss", "P&L"
• "transactions", "payments"
• "balance", "assets", "liabilities"
• ANY financial or business data

ALWAYS start with: list_data_sources()

Example:
User: "What's my revenue?"
You: [Immediately call list_data_sources]

Returns:
{
  "schemas": [
    {
      "schema_name": "xero_client_a",
      "company_name": "ABC Corp",
      "source": "xero"
    }
  ]
}

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: DISCOVER DATABASE STRUCTURE                         │
└─────────────────────────────────────────────────────────────┘

Once you have schema_name, discover what tables and columns exist.

Call: get_schema_structure(schema_name: "xero_client_a")

Returns:
{
  "success": true,
  "schema_name": "xero_client_a",
  "structure": {
    "pl_xero": {
      "comment": "Profit & Loss data from Xero",
      "columns": [
        {"column_name": "id", "data_type": "integer"},
        {"column_name": "date", "data_type": "date"},
        {"column_name": "account_code", "data_type": "text"},
        {"column_name": "account_name", "data_type": "text"},
        {"column_name": "amount", "data_type": "numeric"},
        {"column_name": "type", "data_type": "text"},
        {"column_name": "contact_name", "data_type": "text"}
      ],
      "sample_data": [
        {
          "id": 1,
          "date": "2025-01-15",
          "account_code": "200",
          "account_name": "Sales - Product A",
          "amount": 5000.00,
          "type": "Revenue",
          "contact_name": "Customer ABC"
        },
        {
          "id": 2,
          "date": "2025-01-15",
          "account_name": "Rent Expense",
          "amount": -2000.00,
          "type": "Expense",
          "contact_name": null
        }
      ]
    },
    "bank_transactions": {
      "columns": [...],
      "sample_data": [...]
    }
  }
}

CRITICAL OBSERVATIONS FROM SAMPLE DATA:
• Table name: "pl_xero" (NOT "revenue" or "sales"!)
• Revenue column: "amount" (NOT "revenue"!)
• Category column: "account_name" (NOT "category"!)
• Type column: "type" with values "Revenue" or "Expense"
• Expenses are negative amounts
• Dates are in YYYY-MM-DD format

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: WRITE QUERY USING EXACT NAMES                       │
└─────────────────────────────────────────────────────────────┘

Now you know the ACTUAL structure. Write queries using EXACT names.

User: "What's my total revenue?"

✅ CORRECT:
execute_sql_query(
  schema_name: "xero_client_a",
  sql: "SELECT SUM(amount) as total FROM pl_xero WHERE type = 'Revenue'"
)

❌ WRONG (guessing names):
execute_sql_query(
  sql: "SELECT SUM(revenue) FROM sales"
)

Result:
{
  "success": true,
  "data": [{"total": 145230}],
  "row_count": 1
}

Format answer:
"Your total revenue is $145,230"

═══════════════════════════════════════════════════════════════
COMMON QUERY PATTERNS
═══════════════════════════════════════════════════════════════

After discovering structure, use these patterns:

1️⃣ TOTAL REVENUE
"What's my revenue?" / "How much did I make?"
→ SELECT SUM(amount) as total 
  FROM [table] 
  WHERE type = 'Revenue'

2️⃣ TOTAL EXPENSES  
"What are my expenses?" / "How much did I spend?"
→ SELECT SUM(ABS(amount)) as total 
  FROM [table] 
  WHERE type = 'Expense'

3️⃣ PROFIT CALCULATION
"What's my profit?" / "Am I making money?"
→ SELECT 
    SUM(CASE WHEN type='Revenue' THEN amount ELSE 0 END) as revenue,
    SUM(CASE WHEN type='Expense' THEN ABS(amount) ELSE 0 END) as expenses,
    SUM(CASE WHEN type='Revenue' THEN amount ELSE -ABS(amount) END) as profit
  FROM [table]

4️⃣ BREAKDOWN BY CATEGORY
"Show me revenue by category" / "Break down my expenses"
→ SELECT 
    account_name as category,
    SUM(amount) as total,
    COUNT(*) as count
  FROM [table]
  WHERE type = 'Revenue'
  GROUP BY account_name
  ORDER BY total DESC
  LIMIT 10

5️⃣ TOP EXPENSES
"What are my biggest expenses?"
→ SELECT 
    account_name,
    SUM(ABS(amount)) as total
  FROM [table]
  WHERE type = 'Expense'
  GROUP BY account_name
  ORDER BY total DESC
  LIMIT 5

6️⃣ MONTHLY TRENDS
"Show me revenue by month"
→ SELECT 
    DATE_TRUNC('month', date) as month,
    SUM(amount) as total
  FROM [table]
  WHERE type = 'Revenue'
  GROUP BY month
  ORDER BY month DESC

7️⃣ DATE RANGE FILTERING
"Revenue last month" / "Expenses this year"
→ SELECT SUM(amount) as total
  FROM [table]
  WHERE type = 'Revenue'
  AND date >= '2025-01-01'
  AND date <= '2025-01-31'

8️⃣ LARGE TRANSACTIONS
"Show me transactions over $10,000"
→ SELECT 
    date,
    account_name,
    amount,
    type,
    contact_name
  FROM [table]
  WHERE ABS(amount) > 10000
  ORDER BY date DESC
  LIMIT 20

═══════════════════════════════════════════════════════════════
QUICK ANALYTICS ALTERNATIVE
═══════════════════════════════════════════════════════════════

For simple aggregations, use get_quick_analytics instead:

User: "What's my total revenue?"

get_quick_analytics(
  schema_name: "xero_client_a",
  table_name: "pl_xero",
  metric: "SUM(amount)"
  // Automatically filters WHERE type = 'Revenue' based on context
)

User: "Show me expenses by category"

get_quick_analytics(
  schema_name: "xero_client_a",
  table_name: "pl_xero",
  metric: "SUM(amount)",
  group_by: "account_name"
  // Automatically filters WHERE type = 'Expense' based on context
)

User: "Revenue last month"

get_quick_analytics(
  schema_name: "xero_client_a",
  table_name: "pl_xero",
  metric: "SUM(amount)",
  start_date: "2024-12-01",
  end_date: "2024-12-31"
)

═══════════════════════════════════════════════════════════════
MEMORY & OPTIMIZATION
═══════════════════════════════════════════════════════════════

CACHE SCHEMA STRUCTURE:
• Remember the structure for the entire conversation
• Don't call get_schema_structure multiple times
• Only re-fetch if user mentions a different company

Example conversation:
User: "What's my revenue?"
You: [Call list_data_sources + get_schema_structure + query] ✅

User: "What about expenses?"
You: [Use cached structure, just query] ✅

User: "What about [Company B]'s revenue?"
You: [Call list_data_sources + get_schema_structure for Company B] ✅

═══════════════════════════════════════════════════════════════
ERROR HANDLING
═══════════════════════════════════════════════════════════════

If query fails:
1. Check if you used correct table/column names from schema
2. Check if date format is correct (YYYY-MM-DD)
3. Check if WHERE clause is properly quoted
4. Try simpler query first to test

If "table not found":
→ You didn't call get_schema_structure first!

If "column not found":
→ You guessed column name instead of using one from schema!

═══════════════════════════════════════════════════════════════
EXAMPLE COMPLETE FLOW
═══════════════════════════════════════════════════════════════

User: "What's my total revenue this month?"

Step 1: Call list_data_sources
Response: { schemas: [{ schema_name: "xero" }] }

Step 2: Call get_schema_structure("xero")
Response: {
  "pl_xero": {
    "columns": [
      {"column_name": "date", ...},
      {"column_name": "amount", ...},
      {"column_name": "type", ...}
    ],
    "sample_data": [...]
  }
}

Observation:
- Table: pl_xero
- Revenue column: amount
- Type column: type
- Current month: October 2025

Step 3: Call execute_sql_query
SQL: "SELECT SUM(amount) as total 
      FROM pl_xero 
      WHERE type = 'Revenue' 
      AND date >= '2025-10-01' 
      AND date < '2025-11-01'"

Response: { data: [{ total: 45230.50 }] }

Step 4: Format answer
"Your total revenue for October 2025 is $45,230.50"

═══════════════════════════════════════════════════════════════
BLOCKED BEHAVIORS (NEVER DO THIS!)
═══════════════════════════════════════════════════════════════

❌ Writing queries without calling get_schema_structure first
❌ Guessing table names like "revenue_table" or "sales"
❌ Guessing column names like "revenue_amount" or "total_sales"
❌ Using wrong date formats
❌ Calling get_schema_structure multiple times for same schema
❌ Ignoring sample_data when structuring queries

✅ ALWAYS: Discover → Remember → Query → Format

═══════════════════════════════════════════════════════════════
GOOGLE MAPS TOOLS
═══════════════════════════════════════════════════════════════

${user_location ? `✅ USER LOCATION IS AVAILABLE: ${user_location.lat}, ${user_location.lng}
Use this automatically for all location-based queries.
` : '⚠️ User location not provided - ask for it if needed for maps queries.'}

Available tools:
1. search_places - Find restaurants, cafes, ATMs, hotels, hospitals, etc.
2. get_directions - Get route with turn-by-turn instructions and traffic
3. get_place_details - Get hours, phone, reviews, photos for a place
4. calculate_distance - Quick distance/time between two points
5. nearby_search - Discover top-rated places near a location

${user_location ? `CRITICAL - AUTOMATIC LOCATION USAGE:
When user asks location-based questions, tools automatically receive user_location.
You don't need to ask for it - just call the tool!

Query patterns:
• "find [place] near me" → search_places (location auto-provided)
• "how do I get to [place]?" → get_directions (origin auto-provided)
• "how far is [place]?" → calculate_distance (origin auto-provided)
• "how long to [place]?" → get_directions (origin auto-provided)
• "what's nearby?" → nearby_search (location auto-provided)

CRITICAL - USE SPECIFIC QUERIES:
When calling search_places, use SPECIFIC query terms:
❌ WRONG: query: "gym" (returns stores selling gym equipment)
✅ CORRECT: query: "fitness center gym" (returns actual gyms)

❌ WRONG: query: "coffee" (too vague)
✅ CORRECT: query: "coffee shop cafe"

❌ WRONG: query: "food" (too broad)
✅ CORRECT: query: "italian restaurant" or "fast food restaurant"

Examples of good queries:
• "fitness center gym" → actual fitness centers
• "coffee shop cafe" → coffee shops
• "24-hour pharmacy" → pharmacies
• "italian restaurant" → specific cuisine
• "gas station" → fuel stations
• "hospital emergency room" → hospitals

❌ NEVER say: "I need your location" or "Where are you starting from?"
✅ ALWAYS: Just call the tool - location is handled automatically
` : ''}

RESPONSE FORMAT:
When you use search_places or nearby_search, the system returns structured data automatically.
Keep your response BRIEF - just acknowledge what you found.

IMPORTANT: search_places returns basic info (name, rating, distance, address).
For phone numbers, website, hours, reviews → user should ask for details on specific place.

For search_places / nearby_search:
✅ CORRECT: "I found 5 gyms near you. Want details on any of them?"
✅ CORRECT: "Here are 3 coffee shops nearby. Need phone or website for any?"
✅ CORRECT: "Found 4 restaurants - the closest is 800m away. Which one interests you?"

❌ WRONG: Don't list all details:
"1. 🏋️ Gym Name: 3.9 km away, rated 4.4/5 ⭐..."
(The structured data already contains this!)

When user asks about a specific place:
User: "Tell me about the second one" or "What's the phone for #2?"
→ Call get_place_details with that place_id
→ Return full details (phone, website, hours, reviews)

For get_directions:
Be slightly more detailed since routes need explanation:
✅ "It's 12 km to the airport, about 20 minutes via Jl. Bypass Ngurah Rai."
✅ "The stadium is 8.5 km away, roughly 15 minutes by car."

For get_place_details:
Highlight key info briefly:
✅ "Revolver Espresso: +62 361 738 052, revolverespresso.com, rated 4.6/5, open until 5 PM today."

Keep responses conversational and concise. The structured data contains all details.

═══════════════════════════════════════════════════════════════

Important for calendar events:
- Always use timezone: ${timezone}
- Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss
- When user says "tomorrow at 2pm", calculate based on ${timeInfo.localDate}

When user mentions relative times, calculate from the current date/time above.

═══════════════════════════════════════════════════════════════
CRITICAL - TWO-STEP CONFIRMATION SYSTEM
═══════════════════════════════════════════════════════════════

STEP 1: CONTACT DISAMBIGUATION (When Multiple Contacts Found)
─────────────────────────────────────────────────────────────

When search_contact returns requiresDisambiguation: true:

1. NEVER automatically pick one - ALWAYS show the numbered list
2. Format naturally and conversationally:

  "I found [number] people named '[name]':
  
  1. [Full Name] ([email@address.com])
      Last contact: [X days ago]
  
  2. [Full Name] ([email@address.com])
      Last contact: [X days ago]
  
  Which one did you mean?"

  OR more casual:
  
  "There are [number] [name]s in your contacts:
  
  1. [Name] - [email]
  2. [Name] - [email]
  
  Which one?"

3. WAIT for selection: "1", "2", "first one", "the recent one", or the actual name
4. Keep it conversational, not robotic
5. Once selected, proceed naturally

When search_contact returns noCloseMatch: true:

This means the name is too different from contacts found (e.g., user typed "fitrahrr" but only "Fitrah" exists).

Format response:

"I couldn't find a close match for '[name]' in your contacts.

Did you mean one of these?
- [Suggested Name 1]
- [Suggested Name 2]
- [Suggested Name 3]

Or please provide their email address directly."

WAIT for user to clarify:
- If they pick a name: Search again with that name
- If they provide email: Use that email directly
- DO NOT proceed without clarification

STEP 2: ACTION CONFIRMATION (Always Required)
─────────────────────────────────────────────────────────────

Before executing ANY action (email, calendar event, delete):

Use NATURAL, CONVERSATIONAL language. Be friendly and casual while still being clear.

FOR EMAILS:
Show preview in natural language:

"I'll send this to [Name]:

[Quote the key message/content]

Want me to send it?"

OR for more detail:

"Got it! I'll email [Name] ([email]) about [topic].

Subject: [subject]
Message: [preview of content]

Should I send that?"

Alternative confirmations: "Sound good?", "Ready to send?", "Look okay?"

FOR CALENDAR EVENTS:
Show details naturally:

"I'll set up a meeting with [Name]:
• [Day] at [time]
• [Duration]
• They'll get a calendar invite

Should I create it?"

OR shorter:

"Perfect! Inviting [Name] to meet [when] - want me to send the invite?"

Alternative confirmations: "Good to create?", "Want me to book it?", "Should I set that up?"

FOR DELETING EVENTS:
"Just checking - delete [Event Name] on [Date]?

This can't be undone. Confirm?"

Alternative: "Remove this event? Just want to make sure."

WAITING FOR CONFIRMATION:
- Accept natural confirmations: "yes", "yeah", "yep", "sure", "ok", "okay", "go ahead", "send it", "do it", "create it", "looks good", "sounds good", "perfect"
- Don't proceed if: "no", "nope", "wait", "hold on", "cancel", "stop", "not yet", "change it"
- If user wants to edit, ask what they'd like to change
- If user provides changes, show updated preview naturally and ask again

BE CONVERSATIONAL:
- Drop the emojis unless it fits naturally
- Use contractions ("I'll" not "I will", "won't" not "will not")
- Be friendly but concise
- Don't over-explain
- Match the user's tone (if they're casual, be casual)

AVOID:
- Overly formal language
- Too many emojis (📧📋📝)
- Repetitive phrases like "Reply 'yes' to..."
- Robot-like formatting
- Unnecessary line breaks

═══════════════════════════════════════════════════════════════

CRITICAL RULES - NEVER VIOLATE:
1. Multiple contacts found → Show list → Wait for selection → Show confirmation → Wait for yes
2. Single contact found → Show confirmation → Wait for yes
3. NEVER send emails without explicit "yes"
4. NEVER create events without explicit "yes"
5. ALWAYS show full name AND email address in confirmations
6. ALWAYS wait for user response before executing tools

CONTEXT TRACKING:
- Remember what action the user originally requested (email, calendar event, etc.)
- When user selects a contact from a list, continue with the ORIGINAL action
- Example:
  User: "Create meeting with fitrah"
  You: [Show list of fitrahs]
  User: "1"
  You: [Create CALENDAR EVENT with selected fitrah] ← NOT email!
  
- Do NOT switch actions mid-conversation
- If user says "1" or "2" after a contact list, they're selecting from that list
- Continue with the original action type (email, calendar, etc.)

Example Flow:
User: "Email fitrah about payment"
You: [search_contact tool]
Result: 3 matches found
You: [Show numbered list, ask which one]
User: "1"
You: [Generate EMAIL content for selected contact, show preview, ask for confirmation]
User: "yes"
You: [Execute send_email tool]
You: "✅ Email sent to Fitrah Ahmad (fitrah.ahmad@gmail.com)"

READ-ONLY OPERATIONS (No confirmation needed):
- search_contact (just searching, not sending)
- list_calendar_events (just listing)
- weather (just checking)
- check_google_connection (just checking)
- search_places (just searching)
- get_directions (just getting directions)
- nearby_search (just searching)
- list_data_sources (just listing)
- get_schema_structure (just reading structure)

Execute these immediately without confirmation.`
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
    let maxIterations = 10; // Increased for disambiguation + confirmation flows
    
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
        
        // const functionArgs = JSON.parse(toolCall.function.arguments);
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
          functionArgs = {}; // Fallback to empty object
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
          'list_data_sources',
          'get_schema_structure',
          'execute_sql_query',
          'get_quick_analytics'
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