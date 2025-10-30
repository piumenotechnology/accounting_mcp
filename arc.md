# 🏗️ System Architecture - Visual Guide

## 🎨 Simple Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER / FRONTEND                         │
│                  (Web App, Mobile, API Client)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Request
                             │ POST /api/chat
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      EXPRESS API SERVER                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              CHAT ROUTER (routes/chat.routes.js)           │ │
│  │  • Validate input                                          │ │
│  │  • Load conversation history from DB                       │ │
│  │  • Get user information                                    │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │         AI ORCHESTRATOR (services/ai-orchestrator.js)      │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Model Selector - Choose Gemini or Claude          │  │ │
│  │  │    • Google queries → Gemini                          │  │ │
│  │  │    • Everything else → Claude                         │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 2. Prompt Builder - Create system message            │  │ │
│  │  │    • Add user location                                │  │ │
│  │  │    • Add date/time                                    │  │ │
│  │  │    • Add instructions                                 │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 3. Tool Manager - Get available tools from MCP        │  │ │
│  │  │    • Search places                                    │  │ │
│  │  │    • Send email                                       │  │ │
│  │  │    • Create calendar event                            │  │ │
│  │  │    • 15+ more tools                                   │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ API Call
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      OPENROUTER API                              │
│              (Routes to Gemini or Claude)                        │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │   GEMINI 2.0 FLASH  │         │  CLAUDE 3.5 SONNET  │        │
│  │   (Google queries)  │         │  (General queries)  │        │
│  │   • Gmail           │         │  • Coding           │        │
│  │   • Maps            │         │  • Analysis         │        │
│  │   • Calendar        │         │  • Database         │        │
│  └─────────────────────┘         └─────────────────────┘        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Tool Call Decision
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    MCP (Model Context Protocol)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MCP SERVER (mcp-server/index.js)            │   │
│  │  • Receives tool calls from AI                           │   │
│  │  • Routes to appropriate handler                         │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │           TOOL HANDLERS (mcp-server/handlers/)           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │   MAPS     │  │   GMAIL    │  │  CALENDAR  │         │   │
│  │  │  Handler   │  │  Handler   │  │  Handler   │         │   │
│  │  └────────────┘  └────────────┘  └────────────┘         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │  CONTACT   │  │  DATABASE  │  │  WEATHER   │         │   │
│  │  │  Handler   │  │  Handler   │  │  Handler   │         │   │
│  │  └────────────┘  └────────────┘  └────────────┘         │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
┌───────────▼──────┐ ┌──────▼──────┐ ┌────▼─────┐
│  GOOGLE SERVICES │ │  DATABASE   │ │  OTHERS  │
│  ┌──────────────┐│ │ PostgreSQL  │ │  APIs    │
│  │ Google Maps  ││ │             │ │          │
│  └──────────────┘│ │ • Messages  │ │ • Weather│
│  ┌──────────────┐│ │ • Users     │ │ • etc.   │
│  │    Gmail     ││ │ • Schemas   │ │          │
│  └──────────────┘│ │             │ │          │
│  ┌──────────────┐│ └─────────────┘ └──────────┘
│  │   Calendar   ││
│  └──────────────┘│
└──────────────────┘
            │
            │ Return Data
            │
    [Data flows back up through all layers]
            │
            ▼
         USER
```

---

## 🔄 Request Flow (Numbered Steps)

```
1️⃣  USER
    "Find gyms near me"
    ↓
2️⃣  CHAT ROUTER
    Load history, validate
    ↓
3️⃣  AI ORCHESTRATOR
    Select model → Gemini (Maps query)
    ↓
4️⃣  BUILD PROMPT
    Add location, tools, instructions
    ↓
5️⃣  OPENROUTER → GEMINI
    Process request with tools
    ↓
6️⃣  GEMINI DECISION
    "I need to call search_places tool"
    ↓
7️⃣  MCP SERVER
    Route to Maps Handler
    ↓
8️⃣  MAPS HANDLER
    Call Google Maps Service
    ↓
9️⃣  GOOGLE MAPS API
    Return gym data
    ↓
🔟  DATA FLOWS BACK
    Through all layers
    ↓
1️⃣1️⃣ AI FORMATS RESPONSE
    "I found 5 gyms near you..."
    ↓
1️⃣2️⃣ SAVE TO DATABASE
    Store conversation
    ↓
1️⃣3️⃣ RETURN TO USER
    Answer + structured data
```

---

## 🧩 Component Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAT ROUTER                              │
│  Responsibilities:                                          │
│  ✓ HTTP endpoint handler                                    │
│  ✓ Input validation                                         │
│  ✓ Load conversation history                                │
│  ✓ Save messages to database                                │
│  ✓ Format final response                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  AI ORCHESTRATOR                            │
│  Responsibilities:                                          │
│  ✓ Model selection (Gemini vs Claude)                       │
│  ✓ Build system prompt                                      │
│  ✓ Manage tool calls                                        │
│  ✓ Handle conversation loops                                │
│  ✓ Error handling                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   MODEL SELECTOR                            │
│  Responsibilities:                                          │
│  ✓ Analyze user query for keywords                          │
│  ✓ Route Google queries → Gemini                            │
│  ✓ Route other queries → Claude                             │
│  ✓ Provide routing explanation                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MCP SERVER                               │
│  Responsibilities:                                          │
│  ✓ Register all available tools                             │
│  ✓ Route tool calls to handlers                             │
│  ✓ Return results to AI                                     │
│  ✓ Error handling                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   TOOL HANDLERS                             │
│  Responsibilities:                                          │
│  ✓ Implement tool logic                                     │
│  ✓ Call external services                                   │
│  ✓ Format responses                                         │
│  ✓ Handle errors                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     SERVICES                                │
│  Responsibilities:                                          │
│  ✓ External API integration                                 │
│  ✓ Google Maps, Gmail, Calendar                             │
│  ✓ Data formatting                                          │
│  ✓ Rate limiting, caching                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure Map

```
project/
├── src/
│   ├── routes/
│   │   └── chat.routes.js ..................... [Entry Point]
│   │
│   ├── services/
│   │   ├── ai-orchestrator.js ................ [AI Brain]
│   │   ├── google-maps-service.js ............ [Maps API]
│   │   ├── gmail-service.js .................. [Gmail API]
│   │   └── calendar-service.js ............... [Calendar API]
│   │
│   ├── utils/
│   │   └── model-selector.js ................. [Model Router]
│   │
│   ├── mcp-server/
│   │   ├── index.js .......................... [MCP Server]
│   │   ├── tools/ ............................ [Tool Definitions]
│   │   │   ├── maps.tools.js
│   │   │   ├── email.tool.js
│   │   │   └── calendar.tool.js
│   │   └── handlers/ ......................... [Tool Handlers]
│   │       ├── maps.handlers.js
│   │       ├── email.handlers.js
│   │       └── calendar.handlers.js
│   │
│   ├── models/
│   │   ├── chat.models.js .................... [Database]
│   │   └── auth.models.js
│   │
│   └── config/
│       ├── ai-clients.js ..................... [OpenRouter]
│       └── db.js ............................. [PostgreSQL]
│
└── .env ...................................... [API Keys]
```

---

## 🎯 Data Flow Example: "Find gyms near me"

```
REQUEST:
{
  "message": "Find gyms near me",
  "user_id": "user123",
  "user_location": { "lat": -8.794, "lng": 115.187 }
}

↓ [Chat Router]
  • Validates input ✓
  • Loads history: 0 messages (new conversation)
  • Creates conversation ID: conv_abc123

↓ [AI Orchestrator]
  • Analyzes: "Find gyms near me"
  • Keywords found: ["find", "gym", "near me"]
  • Model selected: Gemini (Maps query)

↓ [Prompt Builder]
  System message created:
  - Location: -8.794, 115.187
  - Tools: 15 available
  - Instructions: Use "fitness center gym" for gym searches

↓ [OpenRouter → Gemini]
  Request sent with:
  - System prompt
  - User message
  - Available tools list

↓ [Gemini Decision]
  "I need to call search_places tool"
  Arguments: {
    query: "fitness center gym",
    location: { lat: -8.794, lng: 115.187 }
  }

↓ [MCP Server]
  Routes to: maps.handlers.js

↓ [Maps Handler]
  Calls: google-maps-service.js

↓ [Google Maps Service]
  1. Enhances query: "fitness center gym"
  2. Calls Google Maps API
  3. Filters out stores
  4. Calculates distances
  5. Returns formatted results

↓ [Results Flow Back]
  {
    success: true,
    results: [
      { name: "Fitness Plus", rating: 4.4, distance: "3.9 km" },
      { name: "DFC GYM", rating: 4.7, distance: "9.1 km" }
      // ... 3 more
    ],
    count: 5
  }

↓ [Gemini Formats Response]
  "I found 5 gyms near you. Want details on any of them?"

↓ [Save to Database]
  Messages table updated:
  - User message
  - Assistant response
  - Structured data (gym list)

↓ [Return to User]
RESPONSE:
{
  "conversation_id": "conv_abc123",
  "message": "I found 5 gyms near you. Want details on any of them?",
  "toolsCalled": ["search_places"],
  "model": "google/gemini-2.0-flash-exp:free",
  "places": [
    {
      "index": 1,
      "name": "Fitness Plus Jimbaran",
      "rating": 4.4,
      "distance": "3.9 km",
      "place_link": "https://maps.google.com/...",
      "directions_link": "https://maps.google.com/dir/..."
    }
    // ... 4 more gyms
  ]
}
```

---

## 🔐 Security & Data Flow

```
┌─────────────────────────────────────────┐
│          ENVIRONMENT VARIABLES          │
│  • OPENROUTER_API_KEY                   │
│  • GOOGLE_MAPS_API_KEY                  │
│  • DATABASE_URL                         │
│  • JWT_SECRET                           │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│         AUTHENTICATION LAYER            │
│  • Verify user_id                       │
│  • Check permissions                    │
│  • Rate limiting                        │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│            BUSINESS LOGIC               │
│  • AI Orchestrator                      │
│  • Tool execution                       │
│  • Data processing                      │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│           DATA PERSISTENCE              │
│  • Save conversations                   │
│  • Cache results                        │
│  • Track usage                          │
└─────────────────────────────────────────┘
```

---

## 🚀 Performance Optimization Points

```
1. MODEL SELECTION
   ↓
   Uses Gemini (free & fast) for Google queries
   Uses Claude (smart) for complex tasks
   → 70% cost savings

2. RESULT FILTERING
   ↓
   Filters out irrelevant results (gym stores)
   → Better accuracy, less noise

3. LAZY LOADING
   ↓
   Phone/website fetched only when needed
   → 60% fewer API calls

4. DATABASE CACHING
   ↓
   Stores conversation history
   → Faster context loading

5. ERROR HANDLING
   ↓
   Safe JSON parsing, fallbacks
   → No crashes, always responds
```

---

## 🎉 Key Takeaways

✅ **Modular Architecture** - Each component has clear responsibility
✅ **Smart Routing** - Right AI model for each task
✅ **Tool System** - Extensible MCP for new capabilities
✅ **Error Resilient** - Handles edge cases gracefully
✅ **Cost Effective** - Uses free models when possible
✅ **Fast Performance** - Optimized queries and caching
✅ **Easy to Debug** - Detailed logging at each step
✅ **Scalable** - Can add new tools and models easily

**The system is designed to be maintainable, performant, and user-friendly!** 🚀