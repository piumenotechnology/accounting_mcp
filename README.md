# Multi-Model MCP Backend with OpenRouter

Backend using **OpenRouter** for Claude, GPT-4, and Gemini with MCP tools.

## Features

- 🚀 **OpenRouter Integration**: Single API for all models
- 🤖 **Multiple AI Models**: Claude, GPT-4, Gemini, Llama
- 🔧 **MCP Tools**: Extensible tool system
- 🎯 **Smart Routing**: Auto-selects best model
- 💰 **Cost Tracking**: Token usage monitoring

## Setup

1. Install dependencies:
```bash
npm install
```

2. Get OpenRouter API Key:
   - Go to https://openrouter.ai/
   - Sign up and get your API key
   - You get **$1 free credit** to start!

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your OpenRouter API key:
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

## Run
```bash
npm run dev
```

## Test

### Automatic Model Selection
```bash
# Uses Gemini (FREE, simple task)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count from 1 to 10"}'

# Uses Claude (complex reasoning)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the complexity of this counting algorithm"}'

# Uses GPT-4 (creative)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a poem about numbers"}'
```

### Manual Model Selection
```bash
# Force specific model
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Count from 1 to 5",
    "model": "claude"
  }'

# Available models: claude, gpt4, gemini, gpt-3.5, llama
```

### Check Available Models
```bash
curl http://localhost:3000/api/models
```

Response:
```json
{
  "models": [
    {
      "id": "claude",
      "name": "Claude Sonnet 4.5",
      "modelId": "anthropic/claude-sonnet-4-5-20250929",
      "strengths": "Complex reasoning, analysis, coding",
      "cost": "$$$"
    },
    {
      "id": "gpt4",
      "name": "GPT-4 Turbo",
      "modelId": "openai/gpt-4-turbo",
      "strengths": "Creative writing, general conversation",
      "cost": "$$"
    },
    {
      "id": "gemini",
      "name": "Gemini 2.0 Flash",
      "modelId": "google/gemini-2.0-flash-exp:free",
      "strengths": "Quick tasks, cost-effective",
      "cost": "FREE"
    }
  ]
}
```

## Model Costs (via OpenRouter)

| Model | Cost per 1M tokens | Best For |
|-------|-------------------|----------|
| Gemini 2.0 Flash | **FREE** | Simple tasks, testing |
| Llama 3.1 8B | **FREE** | Open source, experimentation |
| GPT-3.5 Turbo | $0.50 | Fast, general purpose |
| GPT-4 Turbo | $10 | Creative, complex tasks |
| Claude Sonnet 4.5 | $15 | Best reasoning, coding |

## OpenRouter Benefits

✅ **One API key** for all models  
✅ **$1 free credit** to start  
✅ **Automatic fallback** if model unavailable  
✅ **Usage tracking** and analytics  
✅ **Cost optimization** built-in  
✅ **No rate limits** (pay-as-you-go)  

## Examples

### Example 1: Simple Count (Gemini - FREE)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count from 1 to 5"}'
```

Response:
```json
{
  "message": "Here are the numbers: 1, 2, 3, 4, 5",
  "toolsCalled": ["count"],
  "model": "google/gemini-2.0-flash-exp:free",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 25,
    "total_tokens": 175
  }
}
```

### Example 2: With Calculator
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count from 1 to 5 and add them all"}'
```

Response uses both `count` and `calculate` tools!

## Architecture
```
Request → Express
    ↓
AI Orchestrator → Model Selector
    ↓
OpenRouter (single client)
    ↓
[Claude / GPT-4 / Gemini / Llama]
    ↓
MCP Client → MCP Server → Tools
```

## Adding More Models

Just add to `src/config/ai-clients.js`:
```javascript
export const models = {
  // ... existing models
  
  'claude-opus': {
    id: 'anthropic/claude-opus-4-20250514',
    name: 'Claude Opus 4',
    strengths: 'Most powerful reasoning',
    cost: '$$$$',
    provider: 'openrouter'
  }
};
```

## Cost Tracking

Every response includes token usage:
```json
{
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

Monitor your usage at: https://openrouter.ai/activity