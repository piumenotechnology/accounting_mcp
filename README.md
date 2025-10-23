# Multi-Model MCP Backend

Backend with Claude, OpenAI, and Gemini support using MCP tools.

## Features

- 🤖 **Multiple AI Models**: Claude, GPT-4, Gemini
- 🔧 **MCP Tools**: Counter tool (easily extensible)
- 🎯 **Smart Routing**: Automatically selects best model for task
- 🔄 **Function Calling**: All models can use MCP tools

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
```

**Note:** You can configure just one or all three models.

## Run
```bash
npm run dev
```

## Test

### Automatic Model Selection

The system automatically selects the best model based on your message:
```bash
# Uses Claude (complex reasoning)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the algorithm complexity of bubble sort"}'

# Uses GPT-4 (creative writing)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a short story about a robot"}'

# Uses Gemini (simple/quick task)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count from 1 to 10"}'
```

### Check Available Models
```bash
curl http://localhost:3000/api/models
```

Response:
```json
{
  "available": {
    "claude": true,
    "openai": true,
    "gemini": true
  },
  "models": {
    "claude": "Claude Sonnet 4.5 - Complex reasoning, analysis, coding",
    "openai": "GPT-4 Turbo - Creative writing, general conversation",
    "gemini": "Gemini 2.0 Flash - Quick tasks, cost-effective"
  }
}
```

## Model Selection Rules

| Keywords | Selected Model | Reason |
|----------|---------------|--------|
| analyze, complex, code, debug | Claude | Best reasoning |
| write, creative, story, poem | GPT-4 | Best creative |
| count, calculate, simple | Gemini | Cheapest |
| (default) | Gemini | Cost-effective |

## Examples

### Example 1: Counting (Gemini)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count from 1 to 5"}'
```

Response:
```json
{
  "message": "Here are the numbers from 1 to 5: 1, 2, 3, 4, 5",
  "toolsCalled": ["count"],
  "model": "gemini-2.0-flash"
}
```

### Example 2: Complex Analysis (Claude)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the complexity of counting from 1 to 100"}'
```

Response:
```json
{
  "message": "Let me count and analyze... [detailed analysis]",
  "toolsCalled": ["count"],
  "model": "claude-sonnet-4-5"
}
```

### Example 3: Creative (GPT-4)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a poem about counting"}'
```

Response:
```json
{
  "message": "One by one, the numbers rise...",
  "toolsCalled": [],
  "model": "gpt-4o-mini"
}
```

## Architecture
```
Request → Express → AI Orchestrator → Model Selector
                          ↓
                    [Claude/OpenAI/Gemini]
                          ↓
                    MCP Client
                          ↓
                    MCP Server
                          ↓
                    Counter Tool
```

## Adding More Tools

1. Create tool file: `src/mcp-server/tools/your-tool.js`
2. Add to `src/mcp-server/index.js` in `tools/list`
3. Add execution in `tools/call`

All three AI models will automatically have access to the new tool!