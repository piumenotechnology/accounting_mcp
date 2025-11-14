import express from 'express';
import { chatModels } from '../models/chat.model.js';
import { authModels } from '../models/user.models.js'
import AIOrchestrator from '../services/ai-orchestrator.js'; // Adjust path

import AIVisualizer from '../utils/visualization/ai-visualizer.js';
// Initialize visualizer
const aiVisualizer = new AIVisualizer();

const router = express.Router();

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const aiOrchestrator = new AIOrchestrator();

router.post('/', async (req, res) => {
  try {
    const { message, model, user_id, chat_id, user_location } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    let conversationId = chat_id;
    let conversationHistory = [];

    // If chat_id provided, get existing conversation
    if (conversationId) {
      const conversation = await chatModels.getConversationById(conversationId, user_id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Get conversation history from database
      const historyFromDB = await chatModels.getConversationHistory(conversationId);
      
      // Format history for AI (only role and content)
      conversationHistory = historyFromDB.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } else {
      // Create new conversation
      const selectedModel = model || 'openai';
      const newConversation = await chatModels.createConversation(user_id);
      conversationId = newConversation.id;
      console.log('✨ Created new conversation:', conversationId);
    }

    // Save current user message to database
    await chatModels.saveMessage(conversationId, 'user', message);

    // Add current message to history for AI
    conversationHistory.push({
      role: 'user',
      content: message
    });

    const user = await authModels.getUserByid(user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Call AI Orchestrator with full conversation history + location
    console.log('🤖 Processing with AI Orchestrator...');
    const response = await aiOrchestrator.processMessage(
      message, 
      user_id, 
      model,
      conversationHistory,
      user_location,
      user.name
    );

    // Check which tools were used
    const mapsToolsUsed = response.toolsCalled?.some(tool => 
      ['search_places', 'get_directions', 'get_place_details', 'nearby_search', 'calculate_distance'].includes(tool)
    );

    const searchToolsUsed = response.toolsCalled?.some(tool =>
      ['web_search', 'news_search', 'deep_search'].includes(tool)
    );

    const sqlUsed = response.toolsCalled?.some(tool =>
      ['execute_query'].includes(tool)
    );

    // let summarized = await summarizeText(response.message, "medium", "crisp");
    let summarized = await summarizeText(
                    response.message, 
                    message,   //user question
                    "medium", 
                    "crisp"
                  );

    // console.log(response.toolResults);

    const responseData = {
      conversation_id: conversationId,
      message: summarized,
      message_raw: response.message,
      toolsCalled: response.toolsCalled,
      model: response.model,
      usage: response.usage
    };

    console.log('✅ Response completed');

    // Update conversation timestamp
    await chatModels.updateConversationTimestamp(conversationId);

    // Format and include structured data if any tools with structured output were used
    if ((mapsToolsUsed || searchToolsUsed || sqlUsed) && response.toolResults) {
      const structuredData = await formatStructuredData(response.toolResults, user_location);
      Object.assign(responseData, structuredData);
      
      // Save AI response to database with structured data
      await chatModels.saveMessage(
        conversationId,
        'assistant',
        // response.message,
        summarized,
        response.model,
        response.usage?.total_tokens || 0,
        structuredData
      );
    } else {
      // Save AI response to database without structured data
      await chatModels.saveMessage(
        conversationId,
        'assistant',
        // response.message,
        summarized,
        response.model,
        response.usage?.total_tokens || 0
      );

    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
});

async function formatStructuredData(toolResults, user_location) {
  const result = {};
  
  for (const toolResult of toolResults || []) {
    const { tool, data } = toolResult;

    // DATABASE TOOLS - ADD THIS SECTION

    if (tool === 'execute_query' && data.rows) {

      console.log(data.rows)

      if (data.rows && data.rows.length > 0) {
        try {
          const vizPayload = await aiVisualizer.generateVisualization({
            rows: data.rows,
            query: data.query,
            userQuestion: data.user_question || '',
            schema_name: data.schema_name
          });
          result.visualization = {variants : vizPayload}        
          // if (vizPayload.visual) {
          //   result.visualization = {
          //     // default_visual: vizPayload.visual,
          //     // default_type: vizPayload.default,
          //     variants: vizPayload.variants || [],
          //     // ai_reasoning: vizPayload.content
          //   };
          // }
        } catch (vizError) {
          console.error('❌ Visualization error:', vizError);
          result.visualization_error = vizError.message;
        }
      }
    }

    // MAPS TOOLS
    // Format places from search_places
    if (tool === 'search_places' && data.results && data.results.length > 0) {
      result.places = data.results.map((place, index) => ({
        index: index + 1,
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        rating: place.rating || null,
        phone: place.phone || null,
        website: place.website || null,
        open_now: place.open_now !== null ? place.open_now : null,
        price_level: place.price_level || null,
        lat: place.location?.lat,
        lng: place.location?.lng,
        distance: place.distance,
        distance_meters: place.distance_meters,
        place_link: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        directions_link: user_location && place.location
          ? `https://www.google.com/maps/dir/?api=1&origin=${user_location.lat}%2C${user_location.lng}&destination=${place.location.lat}%2C${place.location.lng}&travelmode=driving`
          : null
      }));
    }
    
    // Format nearby places from nearby_search
    if (tool === 'nearby_search' && data.results && data.results.length > 0) {
      result.places = data.results.map((place, index) => ({
        index: index + 1,
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        rating: place.rating || null,
        phone: null,
        website: null,
        open_now: place.open_now !== null ? place.open_now : null,
        types: place.types,
        lat: place.location?.lat,
        lng: place.location?.lng,
        distance: place.distance,
        distance_meters: place.distance_meters,
        place_link: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        directions_link: user_location && place.location
          ? `https://www.google.com/maps/dir/?api=1&origin=${user_location.lat}%2C${user_location.lng}&destination=${place.location.lat}%2C${place.location.lng}&travelmode=driving`
          : null
      }));
    }
    
    // Format directions from get_directions
    if (tool === 'get_directions' && data.routes && data.routes.length > 0) {
      result.directions = {
        origin: data.origin,
        destination: data.destination,
        mode: data.mode,
        routes: data.routes.map(route => ({
          summary: route.summary,
          distance: route.distance,
          distance_value: route.distance_value,
          duration: route.duration,
          duration_value: route.duration_value,
          duration_in_traffic: route.duration_in_traffic,
          steps: route.steps?.map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            start_location: step.start_location,
            end_location: step.end_location
          })),
          traffic_info: route.traffic_info
        }))
      };
    }
    
    // Format place details from get_place_details
    if (tool === 'get_place_details' && data.place_id) {
      result.place_details = {
        place_id: data.place_id,
        name: data.name,
        address: data.formatted_address,
        phone: data.phone || null,
        website: data.website || null,
        rating: data.rating || null,
        ratings_count: data.ratings_count || 0,
        price_level: data.price_level || null,
        opening_hours: data.opening_hours,
        reviews: data.reviews?.slice(0, 3),
        photos: data.photos?.slice(0, 5)?.map(photo => ({
          url: photo.url,
          width: photo.width,
          height: photo.height
        })),
        types: data.types,
        location: data.location,
        place_link: `https://www.google.com/maps/place/?q=place_id:${data.place_id}`,
        directions_link: user_location && data.location
          ? `https://www.google.com/maps/dir/?api=1&origin=${user_location.lat}%2C${user_location.lng}&destination=${data.location.lat}%2C${data.location.lng}&travelmode=driving`
          : null
      };
    }
    
    // Format distance from calculate_distance
    if (tool === 'calculate_distance' && data.distance) {
      result.distance_info = {
        distance: data.distance,
        distance_value: data.distance_value,
        duration: data.duration,
        duration_value: data.duration_value,
        duration_in_traffic: data.duration_in_traffic,
        mode: data.mode
      };
    }
    

    // SEARCH TOOLS (Tavily)
    // Format web search results
    if (tool === 'web_search' && data.success) {
      result.search_results = {
        // query: data.data.query,
        // answer: data.data.answer || null, // AI-generated summary
        results: data.data.results?.map((item, index) => ({
          index: index + 1,
          title: item.title,
          url: item.url,
          content: item.content, // Excerpt/snippet
          score: item.score,
          published_date: item.published_date || null
        })) || [],
        images: data.data.images || [], // Array of image URLs
        response_time: data.data.response_time
      };
    }
    
    // Format news search results
    if (tool === 'news_search' && data.success) {
      result.news_results = {
        // query: data.data.query,
        // answer: data.data.answer || null, // AI summary of news
        articles: data.data.articles?.map((article, index) => ({
          index: index + 1,
          title: article.title,
          url: article.url,
          content: article.content,
          published_date: article.published_date,
          source: article.source,
          score: article.score,
        })) || [],
        images : data.data.images,
        days: data.data.days
      };
    }
    
    // Format deep search results
    if (tool === 'deep_search' && data.success) {
      result.research_results = {
        // query: data.data.query,
        // answer: data.data.answer || null, // Comprehensive AI summary
        results: data.data.results?.map((item, index) => ({
          index: index + 1,
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
          published_date: item.published_date || null
        })) || [],
        images: data.data.images || [],
        response_time: data.data.response_time
      };
    }
  }
  
  return result;
}

// util: strip markdown, collapse whitespace, fix spacing
function cleanPlainText(s) {
  if (!s) return "";
  return String(s)
    // remove bold/italic/backticks
    .replace(/[*_`]+/g, "")
    // remove markdown headings and list bullets
    .replace(/^\s{0,3}(#{1,6}\s*)/gm, "")
    .replace(/^\s{0,3}(\d+\.|\-|\+|\*)\s+/gm, "")
    // convert <br> and newlines to spaces
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\r?\n+/g, " ")
    // collapse spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

// async function summarizeText(
//   text,
//   length = "short",
//   tone = "casual"
// ) {
//   if (!text || !text.trim()) {
//     throw new Error("No text provided for summarization.");
//   }

//   const systemPrompt = [
//     "You are a precise summarizer.",
//     "Summarize the text accurately and clearly.",
//     `Target length: ${length}. Desired tone: ${tone}.`,
//     "Return JSON only with this schema:",
//     "{ summary: string }",
//     "No markdown, no asterisks, no headings, no lists, no links, no emojis.",
//     "One compact paragraph, readable, plain punctuation only."
//   ].join(" ");

//   try {
//     const response = await client.chat.completions.create({
//       model: "gpt-4.1-mini",
//       temperature: 0,
//       max_tokens: 300,
//       // ask for structured output
//       response_format: {
//         type: "json_schema",
//         json_schema: {
//           name: "summary_schema",
//           schema: {
//             type: "object",
//             properties: {
//               summary: { type: "string" }
//             },
//             required: ["summary"],
//             additionalProperties: false
//           },
//           strict: true
//         }
//       },
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: text }
//       ]
//     });

//     // primary path, parse JSON and sanitize just in case
//     const raw = response.choices?.[0]?.message?.content ?? "";
//     let obj;
//     try {
//       obj = JSON.parse(raw);
//     } catch {
//       // some SDKs already return parsed JSON in message.content[0].text,
//       // if so, fall through to cleaner below
//       obj = { summary: raw };
//     }
//     return cleanPlainText(obj.summary);
//   } catch (err) {
//     // fallback: run a plain generation then sanitize
//     const fallback = await client.chat.completions.create({
//       model: "gpt-4.1-mini",
//       temperature: 0,
//       max_tokens: 300,
//       messages: [
//         {
//           role: "system",
//           content:
//             "Summarize clearly. Plain text only, no markdown, no lists, one short paragraph."
//         },
//         { role: "user", content: text }
//       ]
//     });
//     const textOut = fallback.choices?.[0]?.message?.content ?? "";
//     return cleanPlainText(textOut);
//   }
// }

// GET /api/chat/conversations/:user_id - Get all user conversations
/**
 * Intelligently summarize or format based on user intent
 */
async function summarizeText(
  text,
  userQuestion = "",
  length = "short",
  tone = "casual"
) {
  if (!text || !text.trim()) {
    throw new Error("No text provided for summarization.");
  }

  // Detect if user wants a list/enumeration
  const wantsList = /\b(list|enumerate|show me|give me|name|top \d+|\d+ (latest|recent|best|top))/i.test(userQuestion);
  
  // Detect if asking for specific count
  const countMatch = userQuestion.match(/\b(\d+)\b/);
  const requestedCount = countMatch ? parseInt(countMatch[1]) : null;

  let systemPrompt;

  if (wantsList) {
    systemPrompt = [
      "You are a precise formatter.",
      "The user asked for a list. Preserve the list format.",
      requestedCount ? `Return exactly ${requestedCount} items.` : "Return all items from the source.",
      "Format as clean numbered list:",
      "1. Item one - brief description",
      "2. Item two - brief description",
      "Return JSON: { summary: string }",
      "The summary field should contain the numbered list with line breaks (\\n).",
      `Tone: ${tone}. Keep descriptions ${length}.`
    ].join(" ");
  } else {
    systemPrompt = [
      "You are a precise summarizer.",
      "Summarize the text accurately and clearly into a flowing paragraph.",
      `Target length: ${length}. Desired tone: ${tone}.`,
      "Return JSON only: { summary: string }",
      "No markdown formatting, no asterisks, no headings.",
      "One compact paragraph with plain punctuation only."
    ].join(" ");
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "summary_schema",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" }
            },
            required: ["summary"],
            additionalProperties: false
          },
          strict: true
        }
      },
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Original question: "${userQuestion}"\n\nText to process:\n${text}` 
        }
      ]
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = { summary: raw };
    }

    // For lists, preserve line breaks; for prose, clean them
    if (wantsList) {
      return obj.summary; // Keep \n for list items
    } else {
      return cleanPlainText(obj.summary);
    }
    
  } catch (err) {
    console.error("Summarization error:", err);
    // Fallback
    return wantsList ? text : cleanPlainText(text);
  }
}

router.get('/conversations/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const conversations = await chatModels.getUserConversations(user_id);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/chat/history/:chat_id - Get conversation history
router.get('/history/:chat_id', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Verify ownership
    const conversation = await chatModels.getConversationById(chat_id, user_id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const history = await chatModels.getConversationHistory(chat_id);
    res.json({ success: true, history });
  } catch (error) {
    console.error('❌ Error fetching history:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// DELETE /api/chat/:chat_id - Delete conversation
router.delete('/:chat_id', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const deleted = await chatModels.deleteConversation(chat_id, user_id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('❌ Error deleting conversation:', error.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// PATCH /api/chat/:chat_id/title - Update conversation title
router.patch('/:chat_id/details', async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { user_id, title, favorite } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const updated = await chatModels.updateConversationDetails(chat_id, user_id, { title, favorite });

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error('❌ Error updating conversation details:', error.message);
    res.status(500).json({ error: 'Failed to update conversation details' });
  }
});

export default router;