# 🔄 Complete System Flow: User Question → AI Answer

## 📊 High-Level Overview

```
USER
  ↓ (1) Sends message
FRONTEND/API
  ↓ (2) Routes to chat endpoint
CHAT ROUTER
  ↓ (3) Loads conversation history
AI ORCHESTRATOR
  ↓ (4) Selects model (Gemini/Claude)
  ↓ (5) Builds system prompt
  ↓ (6) Gets available tools
OPENROUTER API
  ↓ (7) AI processes request
  ↓ (8) Decides to use tools?
       ├─ NO → (9) Returns answer
       └─ YES → (10) Calls tool via MCP
MCP SERVER
  ↓ (11) Executes tool (Gmail, Maps, Calendar, etc.)
GOOGLE APIs / DATABASE
  ↓ (12) Returns data
AI ORCHESTRATOR
  ↓ (13) Formats response
  ↓ (14) Saves to database
CHAT ROUTER
  ↓ (15) Adds structured data
  ↓ (16) Returns JSON response
USER
  ✅ Gets answer + data
```

---

## 🎯 Detailed Step-by-Step Flow

### **STEP 1: User Sends Message**

**User makes HTTP request:**

```json
POST http://localhost:3000/api/chat

{
  "message": "Find gyms near me",
  "user_id": "user123",
  "user_location": {
    "lat": -8.7947335,
    "lng": 115.1871132
  }
}
```

---

### **STEP 2: Request Hits Chat Router**

**File:** `src/routes/chat.routes.js`

```javascript
router.post('/', async (req, res) => {
  const { message, model, user_id, chat_id, user_location } = req.body;
  
  // Validate input
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  
  // Continue to next step...
})
```

**What happens:**
- ✅ Validates message and user_id
- ✅ Extracts user location

---

### **STEP 3: Load Conversation History**

```javascript
// If chat_id provided, load existing conversation
if (chat_id) {
  const conversation = await chatModels.getConversationById(chat_id, user_id);
  const historyFromDB = await chatModels.getConversationHistory(chat_id);
  
  // Format for AI
  conversationHistory = historyFromDB.map(msg => ({
    role: msg.role,      // 'user' or 'assistant'
    content: msg.content // The actual message
  }));
}

// Save current user message
await chatModels.saveMessage(chat_id, 'user', message);
```

**Example conversation history:**
```javascript
[
  { role: 'user', content: 'What is quantum physics?' },
  { role: 'assistant', content: 'Quantum physics is...' },
  { role: 'user', content: 'Find gyms near me' } // ← Current message
]
```

---

### **STEP 4: AI Orchestrator - Model Selection**

**File:** `src/services/ai-orchestrator.js`

```javascript
// Auto-select model based on query
const selectedModel = this.modelSelector.selectModel(message);

// "Find gyms near me" contains "find", "gym", "near me"
// → Keywords detected: Maps-related
// → Model selected: GEMINI ✅
```

**Decision Logic:**
```
Message: "Find gyms near me"
  ↓
Keywords found: ["find", "gym", "near me"]
  ↓
Category: Google Maps query
  ↓
Model: GEMINI (best for Google services)
```

**Alternative:**
```
Message: "Write Python code"
  ↓
No Google keywords
  ↓
Category: General/Coding
  ↓
Model: CLAUDE (best for coding)
```

---

### **STEP 5: Build System Prompt**

**AI Orchestrator creates detailed instructions:**

```javascript
const systemMessage = {
  role: 'system',
  content: `
    Current Location: ${user_location.lat}, ${user_location.lng}
    User Name: ${user_name}
    Date/Time: ${currentDateTime}
    Timezone: ${timezone}
    
    AVAILABLE TOOLS:
    - search_places (find restaurants, gyms, etc.)
    - get_directions (navigation)
    - send_email (Gmail)
    - create_calendar_event (Google Calendar)
    - list_data_sources (database queries)
    ... and more
    
    INSTRUCTIONS:
    - Use specific queries: "fitness center gym" not just "gym"
    - User location is already provided, don't ask for it
    - For Gmail/Calendar: Show confirmation before sending
    - Keep responses concise
  `
}
```

---

### **STEP 6: Get Available Tools from MCP**

```javascript
await this.mcpClient.connect();
const mcpTools = await this.mcpClient.listTools();

// Returns:
[
  { name: 'search_places', description: '...', inputSchema: {...} },
  { name: 'get_directions', description: '...', inputSchema: {...} },
  { name: 'send_email', description: '...', inputSchema: {...} },
  { name: 'create_calendar_event', description: '...', inputSchema: {...} },
  // ... 15+ more tools
]
```

**Convert to OpenAI format:**
```javascript
const tools = mcpTools.tools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }
}));
```

---

### **STEP 7: Send to OpenRouter/AI**

```javascript
const response = await openRouterClient.chat.completions.create({
  model: 'google/gemini-2.0-flash-exp:free', // or Claude
  messages: [
    systemMessage,                    // System instructions
    ...conversationHistory,           // Previous messages
    { role: 'user', content: message } // Current question
  ],
  tools: tools,  // Available tools list
  tool_choice: 'auto' // Let AI decide
});
```

**Request sent to OpenRouter:**
```json
{
  "model": "google/gemini-2.0-flash-exp:free",
  "messages": [
    {
      "role": "system",
      "content": "Current Location: -8.794, 115.187..."
    },
    {
      "role": "user",
      "content": "Find gyms near me"
    }
  ],
  "tools": [ /* 15+ tools */ ],
  "tool_choice": "auto"
}
```

---

### **STEP 8: AI Processes & Decides**

**Gemini analyzes the request:**

```
User said: "Find gyms near me"
  ↓
I have a tool called "search_places"
  ↓
User location is provided: -8.794, 115.187
  ↓
System said: Use "fitness center gym" for gyms
  ↓
Decision: Call search_places tool
  ↓
Arguments: {
  query: "fitness center gym",
  location: { lat: -8.794, lng: 115.187 },
  radius: 5000
}
```

**AI Response:**
```json
{
  "finish_reason": "tool_calls",
  "message": {
    "tool_calls": [
      {
        "id": "call_abc123",
        "function": {
          "name": "search_places",
          "arguments": "{\"query\":\"fitness center gym\",\"location\":{\"lat\":-8.794,\"lng\":115.187}}"
        }
      }
    ]
  }
}
```

---

### **STEP 9: AI Orchestrator Handles Tool Call**

```javascript
const toolCall = response.choices[0].message.tool_calls[0];

console.log(`⚡ Calling tool: ${toolCall.function.name}`);
// Output: ⚡ Calling tool: search_places

// Parse arguments safely
let functionArgs = JSON.parse(toolCall.function.arguments);
// Result: { query: "fitness center gym", location: {...} }

// Inject user_location (already included, but double-check)
if (toolsRequiringLocation.includes('search_places') && user_location) {
  functionArgs.user_location = user_location;
  console.log('📍 Injected user_location');
}
```

---

### **STEP 10: Call Tool via MCP Server**

**AI Orchestrator → MCP Client:**
```javascript
const toolResult = await this.mcpClient.callTool({
  name: 'search_places',
  arguments: {
    query: 'fitness center gym',
    location: { lat: -8.794, lng: 115.187 },
    radius: 5000
  }
});
```

**MCP Client → MCP Server:**
```javascript
// File: src/mcp-server/index.js
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const handler = toolHandlers[name]; // Get search_places handler
  return await handler(args);
});
```

---

### **STEP 11: MCP Server Executes Tool**

**File:** `src/mcp-server/handlers/maps.handlers.js`

```javascript
search_places: async (args) => {
  const { query, location, radius, user_location } = args;
  
  console.log(`🔍 Searching: "${query}" near ${location.lat}, ${location.lng}`);
  
  // Call Google Maps service
  const result = await googleMapsService.searchPlaces({
    query: 'fitness center gym',
    location: { lat: -8.794, lng: 115.187 },
    radius: 5000
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result)
    }]
  };
}
```

---

### **STEP 12: Google Maps Service**

**File:** `src/services/google-maps-service.js`

```javascript
async searchPlaces({ query, location, radius }) {
  // Enhance query
  enhancedQuery = 'fitness center gym'; // Already optimized
  
  // Call Google Maps API
  const response = await this.client.textSearch({
    params: {
      query: 'fitness center gym',
      location: '-8.7947335,115.1871132',
      radius: 5000,
      type: 'gym',
      key: this.apiKey
    }
  });
  
  let results = response.data.results; // Raw Google results
  
  // Filter out stores/shops
  results = results.filter(place => {
    const isStore = place.types.includes('store');
    const isGym = place.types.includes('gym');
    return !isStore && isGym;
  });
  
  // Calculate distances
  const formattedResults = results.map(place => ({
    name: place.name,
    place_id: place.place_id,
    address: place.formatted_address,
    rating: place.rating,
    distance: '3.9 km', // Calculated
    location: { lat: place.geometry.location.lat, lng: ... }
  }));
  
  return {
    success: true,
    results: formattedResults,
    count: formattedResults.length
  };
}
```

**Google Maps API Response (example):**
```json
{
  "results": [
    {
      "name": "Fitness Plus Jimbaran",
      "place_id": "ChIJ...",
      "formatted_address": "Jl. Bypass Ngurah Rai...",
      "geometry": {
        "location": { "lat": -8.798, "lng": 115.180 }
      },
      "rating": 4.4,
      "types": ["gym", "health", "point_of_interest"]
    },
    {
      "name": "DFC GYM",
      "rating": 4.7,
      "types": ["gym"]
    }
    // ... more gyms
  ]
}
```

---

### **STEP 13: Tool Result Back to AI**

**MCP Server → MCP Client → AI Orchestrator:**

```javascript
const toolResult = {
  content: [{
    type: 'text',
    text: JSON.stringify({
      success: true,
      results: [
        { name: 'Fitness Plus Jimbaran', rating: 4.4, distance: '3.9 km' },
        { name: 'DFC GYM', rating: 4.7, distance: '9.1 km' },
        // ... more
      ],
      count: 5
    })
  }]
};

console.log('✅ Tool result:', toolResult);
```

**AI Orchestrator adds to conversation:**
```javascript
// Add AI's tool call to messages
messages.push(response.choices[0].message);

// Add tool result to messages
messages.push({
  role: 'tool',
  tool_call_id: 'call_abc123',
  content: JSON.stringify(toolResult.content)
});
```

---

### **STEP 14: AI Generates Final Response**

**Send back to AI with tool result:**
```javascript
const finalResponse = await openRouterClient.chat.completions.create({
  model: 'google/gemini-2.0-flash-exp:free',
  messages: [
    systemMessage,
    { role: 'user', content: 'Find gyms near me' },
    { role: 'assistant', tool_calls: [...] }, // AI's tool call
    { role: 'tool', content: '{"results":[...]}' }, // Tool result
  ],
  tools: tools,
  tool_choice: 'auto'
});
```

**AI Generates Answer:**
```
I found 5 gyms near you. Want details on any of them?
```

**Response:**
```json
{
  "finish_reason": "stop",
  "message": {
    "role": "assistant",
    "content": "I found 5 gyms near you. Want details on any of them?"
  }
}
```

---

### **STEP 15: Format Structured Data**

**Chat Router adds Google Maps data:**

```javascript
// Check if Maps tools were used
const mapsToolsUsed = response.toolsCalled?.includes('search_places');

if (mapsToolsUsed && response.toolResults) {
  const structuredData = formatStructuredData(response.toolResults, user_location);
  
  // structuredData becomes:
  {
    places: [
      {
        index: 1,
        name: "Fitness Plus Jimbaran",
        rating: 4.4,
        distance: "3.9 km",
        address: "...",
        place_link: "https://maps.google.com/...",
        directions_link: "https://maps.google.com/dir/..."
      },
      // ... more
    ]
  }
}
```

---

### **STEP 16: Save to Database**

```javascript
// Save AI response
await chatModels.saveMessage(
  chat_id,
  'assistant',
  response.message,
  'gemini',
  response.usage?.total_tokens || 0,
  structuredData // Include places data
);

// Update conversation timestamp
await chatModels.updateConversationTimestamp(chat_id);
```

**Database now has:**
```sql
INSERT INTO messages (conversation_id, role, content, model, tokens, structured_data)
VALUES (
  'conv_123',
  'assistant',
  'I found 5 gyms near you...',
  'gemini',
  450,
  '{"places":[...]}'
);
```

---

### **STEP 17: Return to User**

**Final JSON response:**
```json
{
  "conversation_id": "conv_abc123",
  "message": "I found 5 gyms near you. Want details on any of them?",
  "toolsCalled": ["search_places"],
  "model": "google/gemini-2.0-flash-exp:free",
  "usage": {
    "prompt_tokens": 1250,
    "completion_tokens": 45,
    "total_tokens": 1295
  },
  "places": [
    {
      "index": 1,
      "name": "Fitness Plus Jimbaran",
      "rating": 4.4,
      "distance": "3.9 km",
      "address": "Jl. Bypass Ngurah Rai...",
      "place_link": "https://maps.google.com/...",
      "directions_link": "https://maps.google.com/dir/..."
    },
    {
      "index": 2,
      "name": "DFC GYM",
      "rating": 4.7,
      "distance": "9.1 km",
      // ...
    }
    // ... 3 more gyms
  ]
}
```

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ USER: "Find gyms near me"                               │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │  CHAT ROUTER          │
         │  - Validate input     │
         │  - Load history       │
         │  - Get user data      │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  AI ORCHESTRATOR      │
         │  - Select model       │
         │  - Build prompt       │
         │  - Load tools         │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  MODEL SELECTOR       │
         │  Keywords: find, gym  │
         │  → GEMINI ✅          │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  OPENROUTER API       │
         │  Send: prompt + tools │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  GEMINI AI            │
         │  Decide: Call tool    │
         │  search_places ✅     │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  MCP CLIENT           │
         │  Forward tool call    │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  MCP SERVER           │
         │  Route to handler     │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  MAPS HANDLER         │
         │  Call Google Maps API │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  GOOGLE MAPS SERVICE  │
         │  - Enhance query      │
         │  - Call API           │
         │  - Filter results     │
         │  - Calculate distance │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  GOOGLE MAPS API      │
         │  Return gym data      │
         └───────────┬───────────┘
                     ↓
         [Results flow back up through each layer]
                     ↓
         ┌───────────────────────┐
         │  GEMINI AI            │
         │  Format response      │
         │  "I found 5 gyms..."  │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  AI ORCHESTRATOR      │
         │  Add structured data  │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  CHAT ROUTER          │
         │  - Save to DB         │
         │  - Format response    │
         └───────────┬───────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  USER: Gets answer + gym list with Google Maps links   │
└─────────────────────────────────────────────────────────┘
```

---

## 💡 Key Components Explained

### **1. Chat Router**
- **Role:** Entry point, validates requests
- **Tasks:** Load history, save messages, format responses
- **File:** `src/routes/chat.routes.js`

### **2. AI Orchestrator**
- **Role:** Brain of the system
- **Tasks:** Select model, build prompts, manage tool calls
- **File:** `src/services/ai-orchestrator.js`

### **3. Model Selector**
- **Role:** Choose best AI model
- **Logic:** Google queries → Gemini, Others → Claude
- **File:** `src/utils/model-selector.js`

### **4. MCP Server**
- **Role:** Tool execution layer
- **Tasks:** Route tool calls, execute handlers
- **File:** `src/mcp-server/index.js`

### **5. Tool Handlers**
- **Role:** Implement specific tools
- **Examples:** Maps, Gmail, Calendar, Database
- **Files:** `src/mcp-server/handlers/*.js`

### **6. Services**
- **Role:** External API integration
- **Examples:** Google Maps, Gmail, Calendar
- **Files:** `src/services/*.js`

---

## 🔄 Special Cases

### **Case 1: No Tools Needed**

```
User: "What is quantum physics?"
  ↓
AI: Answers directly (no tool call)
  ↓
Return: Text response only
```

### **Case 2: Multiple Tool Calls**

```
User: "Find gyms and email me the list"
  ↓
AI calls: search_places
  ↓
AI gets: Gym list
  ↓
AI calls: send_email
  ↓
AI gets: Email sent confirmation
  ↓
Return: "Found 5 gyms and emailed you the list"
```

### **Case 3: Confirmation Required**

```
User: "Email John about the meeting"
  ↓
AI calls: search_contact (find John)
  ↓
AI: "Found 2 Johns, which one?"
  ↓
User: "The first one"
  ↓
AI drafts email
  ↓
AI: "Send this to john@email.com?"
  ↓
User: "Yes"
  ↓
AI calls: send_email
  ↓
Return: "Email sent!"
```

---

## ⚡ Performance

**Average response times:**
- Simple answer (no tools): **1-2 seconds**
- Maps query (1 tool): **2-3 seconds**
- Email with contact search (2 tools): **3-5 seconds**
- Complex multi-tool: **5-10 seconds**

---

## 🎯 Summary

1. **User sends** message to API
2. **Router validates** and loads history
3. **Orchestrator selects** model (Gemini/Claude)
4. **AI decides** if tools needed
5. **MCP executes** tool (Maps, Gmail, etc.)
6. **Service calls** external API (Google, etc.)
7. **Data flows back** through layers
8. **AI formats** final response
9. **Router saves** to database
10. **User receives** answer + structured data

**The entire system is designed to be modular, scalable, and maintainable!** ✨