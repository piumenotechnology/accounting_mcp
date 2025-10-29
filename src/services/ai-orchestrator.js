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
      content: `Current date and time information:
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
        
        // Inject USER_ID for tools that need it
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

        // Inject USER_LOCATION for location-based tools
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
        
        console.log(`✅ Tool result:`, toolResult.content[0].text.substring(0, 200) + '...');
        
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