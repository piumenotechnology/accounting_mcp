# System Architecture & Data Flow

## 1. High-Level Architecture

```mermaid
graph TB
    Client[Client Application]
    API[Express API Router]
    AIOrch[AI Orchestrator]
    MCP[MCP Server]
    OpenRouter[OpenRouter/LLM]
    
    Client -->|POST /chat| API
    API -->|processMessage| AIOrch
    AIOrch -->|Tool Definitions| MCP
    AIOrch <-->|Chat Completions| OpenRouter
    OpenRouter -->|Tool Calls| AIOrch
    AIOrch -->|Execute Tool| MCP
    MCP -->|Tool Results| AIOrch
    AIOrch -->|Response| API
    API -->|JSON Response| Client
    
    subgraph External Services
        Google[Google APIs<br/>Calendar/Gmail/Contacts]
        GoogleMaps[Google Maps API]
        Tavily[Tavily Search API]
        Database[(PostgreSQL<br/>Multi-tenant)]
    end
    
    MCP -->|Calendar/Email/Contact Tools| Google
    MCP -->|Maps Tools| GoogleMaps
    MCP -->|Search Tools| Tavily
    MCP -->|Database Queries| Database
```

## 2. Detailed Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Router
    participant ChatModels
    participant AIOrch as AI Orchestrator
    participant ModelSelector
    participant MCPClient
    participant MCPServer
    participant LLM as OpenRouter/LLM
    participant Services as External Services
    participant DBService as Database Service
    participant Visualizer as AI Visualizer

    Client->>Router: POST /chat {message, user_id, chat_id?, user_location?, model?}
    
    alt New Conversation
        Router->>ChatModels: createConversation(user_id)
        ChatModels-->>Router: conversation_id
    else Existing Conversation
        Router->>ChatModels: getConversationById(chat_id, user_id)
        ChatModels-->>Router: conversation
        Router->>ChatModels: getConversationHistory(chat_id)
        ChatModels-->>Router: history[]
    end
    
    Router->>ChatModels: saveMessage(conversation_id, 'user', message)
    
    Router->>AIOrch: processMessage(message, user_id, model?, history[], location?, name)
    
    AIOrch->>ModelSelector: selectModel(message) [if no model specified]
    ModelSelector-->>AIOrch: selected_model
    
    AIOrch->>DBService: getDatabaseContext(user_id)
    DBService-->>AIOrch: {schemas, structures, available_fields}
    
    AIOrch->>DBService: getTableSamples(user_id, 3)
    DBService-->>AIOrch: sample_data
    
    AIOrch->>AIOrch: buildSystemMessage(user_id, name, location, timezone, timeInfo)
    Note over AIOrch: Builds comprehensive system prompt with:<br/>- User context<br/>- Location info<br/>- Database schema<br/>- Tool instructions
    
    AIOrch->>MCPClient: connect()
    MCPClient->>MCPServer: Initialize connection
    
    AIOrch->>MCPClient: listTools()
    MCPClient->>MCPServer: ListToolsRequest
    MCPServer-->>MCPClient: tools[]
    MCPClient-->>AIOrch: mcpTools
    
    AIOrch->>AIOrch: Convert MCP tools to OpenAI format
    
    loop Tool Execution Loop (max 10 iterations)
        AIOrch->>LLM: chat.completions.create({messages, tools})
        LLM-->>AIOrch: response
        
        alt finish_reason = 'stop'
            Note over AIOrch: No more tool calls, return final answer
        else finish_reason = 'tool_calls'
            AIOrch->>AIOrch: Extract tool_call
            
            alt Tool requires user_id
                AIOrch->>AIOrch: Inject user_id into args
            end
            
            alt Tool requires user_location
                AIOrch->>AIOrch: Inject user_location into args
            end
            
            AIOrch->>MCPClient: callTool(name, args)
            MCPClient->>MCPServer: CallToolRequest
            
            alt Database Tool
                MCPServer->>DBService: execute query/get field
                DBService-->>MCPServer: query results
            else Google Tool
                MCPServer->>Services: Google API call
                Services-->>MCPServer: calendar/email/contact data
            else Maps Tool
                MCPServer->>Services: Google Maps API call
                Services-->>MCPServer: places/directions/details
            else Search Tool
                MCPServer->>Services: Tavily API call
                Services-->>MCPServer: search/news/research results
            end
            
            MCPServer-->>MCPClient: tool_result
            MCPClient-->>AIOrch: tool_result
            
            AIOrch->>AIOrch: Append assistant message + tool result to messages[]
            Note over AIOrch: Continue loop with updated messages
        end
    end
    
    AIOrch-->>Router: {message, toolsCalled[], toolResults[], model, usage}
    
    Router->>Router: summarizeText(message, userQuestion, "medium", "crisp")
    Note over Router: Intelligently summarizes or formats<br/>based on user intent (list vs prose)
    
    alt Tools with structured output used
        Router->>Router: formatStructuredData(toolResults, user_location)
        
        alt Database query results
            Router->>Visualizer: generateVisualization(rows, query, userQuestion)
            Visualizer-->>Router: visualization variants
        end
        
        Router->>ChatModels: saveMessage(conversation_id, 'assistant', summarized, model, tokens, structuredData)
    else No structured data
        Router->>ChatModels: saveMessage(conversation_id, 'assistant', summarized, model, tokens)
    end
    
    Router->>ChatModels: updateConversationTimestamp(conversation_id)
    
    Router-->>Client: JSON Response {conversation_id, message, toolsCalled, places?, directions?, search_results?, visualization?, etc.}
```

## 3. Data Models

### 3.1 Request/Response Models

```mermaid
classDiagram
    class ChatRequest {
        +string message
        +string user_id
        +string? chat_id
        +Object? user_location {lat, lng}
        +string? model
    }
    
    class ChatResponse {
        +string conversation_id
        +string message (summarized)
        +string message_raw
        +string[] toolsCalled
        +string model
        +Object usage
        +Place[]? places
        +Directions? directions
        +PlaceDetails? place_details
        +DistanceInfo? distance_info
        +SearchResults? search_results
        +NewsResults? news_results
        +ResearchResults? research_results
        +Visualization? visualization
    }
    
    class ConversationHistory {
        +string role (user|assistant|tool)
        +string content
        +string? tool_call_id
        +ToolCall[]? tool_calls
    }
    
    class ToolCall {
        +string id
        +string type
        +Object function {name, arguments}
    }
```

### 3.2 Database Models

```mermaid
classDiagram
    class User {
        +string id (PK)
        +string name
        +string email
        +Object? location {lat, lng}
        +string? timezone
    }
    
    class Conversation {
        +string id (PK)
        +string user_id (FK)
        +timestamp created_at
        +timestamp updated_at
    }
    
    class Message {
        +string id (PK)
        +string conversation_id (FK)
        +string role
        +string content
        +string? model
        +int? tokens
        +Object? structured_data
        +timestamp created_at
    }
    
    class DatabaseSchema {
        +string schema_name (PK)
        +string user_id (FK)
        +string client_name
        +string? referral
        +Table[] tables
        +Field[] available_fields
    }
    
    class Table {
        +string name
        +Column[] columns
    }
    
    class Column {
        +string name
        +string type
        +boolean nullable
    }
    
    class Field {
        +string name
        +string description
        +string source_table
        +string query_template
    }
    
    User "1" --> "N" Conversation
    Conversation "1" --> "N" Message
    User "1" --> "1" DatabaseSchema
    DatabaseSchema "1" --> "N" Table
    Table "1" --> "N" Column
    DatabaseSchema "1" --> "N" Field
```

### 3.3 Tool System Models

```mermaid
classDiagram
    class MCPTool {
        +string name
        +string description
        +Object inputSchema
    }
    
    class OpenAITool {
        +string type = "function"
        +Function function
    }
    
    class Function {
        +string name
        +string description
        +Object parameters
    }
    
    class ToolResult {
        +string tool
        +Object data
    }
    
    class GoogleTools {
        <<interface>>
        +check_google_connection()
        +search_contact(name)
        +send_email(to, subject, body, ...)
        +create_calendar_event(...)
        +list_calendar_events(...)
        +update_calendar_event(...)
        +delete_calendar_event(eventId)
    }
    
    class MapsTools {
        <<interface>>
        +search_places(query, user_location)
        +get_directions(origin, destination, mode)
        +get_place_details(place_id)
        +calculate_distance(origin, destination)
        +nearby_search(radius, type, user_location)
    }
    
    class SearchTools {
        <<interface>>
        +web_search(query, max_results)
        +news_search(query, days, max_results)
        +deep_search(query, max_results)
    }
    
    class DatabaseTools {
        <<interface>>
        +execute_query(schema_name, query, params)
        +get_field_query(field_name)
    }
    
    MCPTool <|-- GoogleTools
    MCPTool <|-- MapsTools
    MCPTool <|-- SearchTools
    MCPTool <|-- DatabaseTools
    MCPTool --> OpenAITool : converts to
    OpenAITool --> ToolResult : produces
```

## 4. Component Responsibilities

```mermaid
graph TD
    subgraph "API Layer"
        Router[Express Router]
    end
    
    subgraph "Business Logic"
        AIOrch[AI Orchestrator]
        ModelSelector[Model Selector]
        DBService[Database Service]
        Visualizer[AI Visualizer]
    end
    
    subgraph "Integration Layer"
        MCPClient[MCP Client]
        MCPServer[MCP Server]
    end
    
    subgraph "Data Layer"
        ChatModels[Chat Models]
        AuthModels[Auth Models]
        Database[(PostgreSQL)]
    end
    
    subgraph "External APIs"
        OpenRouter[OpenRouter/LLM]
        Google[Google APIs]
        Maps[Google Maps]
        Tavily[Tavily Search]
    end
    
    Router -->|Orchestrates| AIOrch
    Router -->|CRUD Operations| ChatModels
    Router -->|User Data| AuthModels
    
    AIOrch -->|Model Selection| ModelSelector
    AIOrch -->|Schema & Context| DBService
    AIOrch -->|Tool Management| MCPClient
    AIOrch -->|Chat Completions| OpenRouter
    
    MCPClient -->|Tool Calls| MCPServer
    
    MCPServer -->|Database Queries| DBService
    MCPServer -->|Calendar/Email| Google
    MCPServer -->|Location Services| Maps
    MCPServer -->|Search Queries| Tavily
    
    DBService -->|Query Execution| Database
    ChatModels -->|Persist Data| Database
    AuthModels -->|User Management| Database
    
    Router -->|Generate Charts| Visualizer
```

## 5. Key Features & Workflows

### 5.1 Database Query Workflow

```mermaid
flowchart TD
    Start([User asks DB question])
    Check{Is it a<br/>pre-configured field?}
    
    Start --> Check
    
    Check -->|Yes| GetField[Call get_field_query<br/>with field_name]
    GetField --> BuildQuery[Receive base query<br/>with correct JOINs/formulas]
    BuildQuery --> AddFilters[Add user's filters<br/>WHERE, GROUP BY, etc.]
    AddFilters --> Execute
    
    Check -->|No| DirectQuery[Build SELECT query<br/>from table schema]
    DirectQuery --> Execute[Call execute_query]
    
    Execute --> Results[Query results returned]
    Results --> Visualize{Results have rows?}
    
    Visualize -->|Yes| GenViz[Call AI Visualizer<br/>generateVisualization]
    GenViz --> VizResult[Return data + chart variants]
    
    Visualize -->|No| TextOnly[Return text response only]
    
    VizResult --> End([Response to user])
    TextOnly --> End
```

### 5.2 Google Tools Workflow (Contact Disambiguation)

```mermaid
flowchart TD
    Start([User: "Email John"])
    Search[Call search_contact<br/>name: "John"]
    
    Start --> Search
    Search --> CheckResult{Result type?}
    
    CheckResult -->|requiresDisambiguation| ShowList[Show numbered list<br/>of matches]
    ShowList --> WaitSelect[Wait for user selection]
    WaitSelect --> RememberIntent[Remember original action<br/>was 'send email']
    RememberIntent --> GetSelection[User picks: "1"]
    GetSelection --> Confirm
    
    CheckResult -->|noCloseMatch| ShowSuggestions[Show suggestions<br/>or ask for email]
    ShowSuggestions --> WaitClarify[Wait for clarification]
    WaitClarify --> Search
    
    CheckResult -->|Single match| Confirm[Show confirmation<br/>"Send to John Doe?"]
    
    Confirm --> UserConfirms{User confirms?}
    UserConfirms -->|Yes| Execute[Execute send_email]
    UserConfirms -->|No/Modify| AskChanges[Ask what to modify]
    AskChanges --> Confirm
    
    Execute --> Success([Email sent])
```

### 5.3 Location-Based Services

```mermaid
flowchart TD
    Start([User asks location query])
    HasLocation{User has<br/>location data?}
    
    Start --> HasLocation
    
    HasLocation -->|Yes| Inject[Auto-inject lat/lng<br/>into tool arguments]
    Inject --> CallTool[Call maps tool<br/>search_places/nearby_search/etc.]
    
    HasLocation -->|No| AskLocation[Ask user for location<br/>or city name]
    AskLocation --> Geocode[Geocode address]
    Geocode --> CallTool
    
    CallTool --> Results[Maps API results]
    Results --> Format[Format as structured data]
    Format --> AddLinks[Add Google Maps links<br/>place_link, directions_link]
    AddLinks --> Response([Return places/directions])
```

## 6. System Context & Prompt Building

```mermaid
graph TB
    subgraph "System Message Components"
        DateTime[Date/Time/Timezone]
        UserContext[User Name + Location]
        Location[Location Context<br/>if available]
        DBContext[Database Schema<br/>+ Sample Data<br/>+ Pre-configured Fields]
        ToolInstructions[Tool-specific Instructions:<br/>- Database workflow<br/>- Google tools workflow<br/>- Maps tools guidance<br/>- Search tools guidance]
    end
    
    subgraph "Dynamic Context"
        UserLocation -->|If exists| Location
        UserID -->|Always| UserContext
        DatabaseService -->|If user has access| DBContext
        TimezoneService -->|Calculated| DateTime
    end
    
    DateTime --> SystemPrompt[Complete System Prompt]
    UserContext --> SystemPrompt
    Location --> SystemPrompt
    DBContext --> SystemPrompt
    ToolInstructions --> SystemPrompt
    
    SystemPrompt -->|Sent to| LLM[Language Model]
```

## 7. Tool Injection Strategy

```mermaid
flowchart LR
    ToolCall[Tool Call from LLM]
    
    ToolCall --> Check1{Requires<br/>user_id?}
    Check1 -->|Yes| InjectUser[Inject user_id]
    Check1 -->|No| Check2
    
    InjectUser --> Check2{Requires<br/>location?}
    Check2 -->|Yes| InjectLoc[Inject user_location]
    Check2 -->|No| Check3
    
    InjectLoc --> Check3{Is execute_query?}
    Check3 -->|Yes| InjectMsg[Inject user_message]
    Check3 -->|No| Execute
    
    InjectMsg --> Execute[Execute tool via MCP]
    Execute --> Result[Tool Result]
```

## 8. Summarization & Response Formatting

```mermaid
flowchart TD
    RawResponse[Raw LLM Response]
    DetectIntent{User wants list?<br/>Check for keywords:<br/>list, enumerate, top N}
    
    RawResponse --> DetectIntent
    
    DetectIntent -->|Yes| FormatList[Preserve numbered list format<br/>with line breaks]
    FormatList --> CountCheck{Requested<br/>specific count?}
    CountCheck -->|Yes| LimitItems[Return exactly N items]
    CountCheck -->|No| AllItems[Return all items]
    
    DetectIntent -->|No| FormatProse[Summarize as flowing paragraph<br/>Remove markdown/formatting]
    FormatProse --> CleanText[cleanPlainText:<br/>Remove *, _, #, etc.]
    
    LimitItems --> FinalResponse
    AllItems --> FinalResponse
    CleanText --> FinalResponse[Final Summarized Response]
    
    FinalResponse --> AddStructured{Structured data<br/>available?}
    AddStructured -->|Yes| Attach[Attach: places, directions,<br/>search_results, visualization]
    AddStructured -->|No| TextOnly[Text response only]
    
    Attach --> Return([Return to client])
    TextOnly --> Return
```

---

## Summary

This system implements a sophisticated multi-agent AI architecture with:

1. **Multi-modal tool integration** (Google, Maps, Search, Database)
2. **Context-aware prompt building** (location, database schema, user context)
3. **Intelligent model selection** based on query complexity
4. **Iterative tool execution** with result aggregation
5. **Structured data formatting** for rich client experiences
6. **Smart summarization** that adapts to user intent
7. **Secure multi-tenant database access** with pre-configured fields
8. **Comprehensive conversation history management**

The flow ensures that every user query is:
- Contextualized with relevant user data
- Routed to appropriate tools
- Executed with proper security controls
- Formatted intelligently for the frontend
- Persisted for conversation continuity
