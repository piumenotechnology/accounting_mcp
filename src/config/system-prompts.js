// src/config/system-prompts.js - COMPLETE WITH FREE SEARCH INTEGRATION

export const PROMPTS = {
  /**
   * BASE PROMPT - Always included (lightweight, ~50-100 tokens)
   */
  BASE: (timeInfo, timezone, user_name) => `Current date and time information:
- Date: ${timeInfo.localDate}
- Time: ${timeInfo.localTime}
- Timezone: ${timezone}
- ISO format: ${timeInfo.iso}

USER INFORMATION:
- User name: ${user_name}

IMPORTANT: You are authorized to query the user's databases directly.
When database schema information is provided below, use it immediately.
Do not ask for permission or clarification - query the data first, then respond.

You are a helpful AI assistant. Provide clear, concise, and accurate responses.`,

  /**
   * LOCATION PROMPT - Only when user_location exists AND query needs maps/location
   */
  LOCATION: (user_location) => `
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

DO NOT respond with "I need your starting point" - USE THE LOCATION ABOVE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════════════════════════════
GOOGLE MAPS TOOLS
═══════════════════════════════════════════════════════════════

Available tools:
1. search_places - Find restaurants, cafes, ATMs, hotels, hospitals, etc.
2. get_directions - Get route with turn-by-turn instructions and traffic
3. get_place_details - Get hours, phone, reviews, photos for a place
4. calculate_distance - Quick distance/time between two points
5. nearby_search - Discover top-rated places near a location

CRITICAL - USE SPECIFIC QUERIES:
❌ WRONG: query: "gym" (returns stores selling gym equipment)
✅ CORRECT: query: "fitness center gym" (returns actual gyms)

RESPONSE FORMAT:
Keep responses BRIEF - acknowledge what you found.
search_places returns basic info (name, rating, distance, address).
For phone numbers, website, hours, reviews → user should ask for details on specific place.`,

  /**
   * EMAIL PROMPT - Only when query mentions email/contact/send
   */
  EMAIL: (user_name) => `
═══════════════════════════════════════════════════════════════
EMAIL & CONTACT TOOLS
═══════════════════════════════════════════════════════════════

EMAIL SIGNATURE:
When sending emails, ALWAYS sign with the user's name:
"Best regards,
${user_name}"

NEVER use "[Your Name]" or placeholder text.

═══════════════════════════════════════════════════════════════
CRITICAL - TWO-STEP CONFIRMATION SYSTEM
═══════════════════════════════════════════════════════════════

STEP 1: CONTACT DISAMBIGUATION (When Multiple Contacts Found)

When search_contact returns requiresDisambiguation: true:
1. NEVER automatically pick one - ALWAYS show the numbered list
2. Format naturally

STEP 2: ACTION CONFIRMATION (Always Required)

Before executing send_email, show preview:
"I'll send this to [Name]: [preview]. Want me to send it?"

WAITING FOR CONFIRMATION:
- Accept: "yes", "yeah", "ok", "send it"
- Don't proceed if: "no", "wait", "cancel"

READ-ONLY OPERATIONS (No confirmation needed):
- search_contact (just searching)`,

  /**
   * CALENDAR PROMPT - Only when query mentions meeting/event/schedule
   */
  CALENDAR: (timezone) => `
═══════════════════════════════════════════════════════════════
CALENDAR TOOLS
═══════════════════════════════════════════════════════════════

Important:
- Always use timezone: ${timezone}
- Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss

CONFIRMATION REQUIRED before creating/updating/deleting events.

READ-ONLY OPERATIONS (No confirmation):
- list_calendar_events
- check_google_connection`,

  /**
   * DATABASE PROMPT - Only when query needs database access
   */
  DATABASE: (databaseContext) => {
    const { schemas, structures } = databaseContext;
    
    let schemaDoc = '';
    
    for (const schema of schemas) {
      const structure = structures[schema.schema_name];
      
      schemaDoc += `\n### ${schema.schema_name} (${schema.client_name})`;
      if (schema.referral) {
        schemaDoc += ` [Ref: ${schema.referral}]`;
      }
      schemaDoc += '\n';
      
      if (structure) {
        for (const table of structure) {
          schemaDoc += `\n**${table.table_name}:**\n`;
          
          let columnsArray = table.columns;
          if (typeof columnsArray === 'string') {
            try {
              columnsArray = JSON.parse(columnsArray);
            } catch (e) {
              columnsArray = [];
            }
          }
          
          const columns = columnsArray.map(c => 
            `  - ${c.name} (${c.type})${c.nullable ? '' : ' NOT NULL'}`
          ).join('\n');
          
          schemaDoc += columns + '\n';
        }
      }
    }
    
    return `
═══════════════════════════════════════════════════════════════
DATABASE QUERY TOOLS
═══════════════════════════════════════════════════════════════

You have FULL ACCESS to query the following databases. This is REAL DATA.
${schemaDoc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TABLE SELECTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT QUERIES (how much paid, total spent):
✅ USE: payment_xero with SUM(total)
❌ DON'T USE: bank_transaction for payment totals

ITEMIZED PURCHASES (what bought, items):
✅ USE: bank_transaction with description, line_amount

PROFIT & LOSS (revenue, expenses):
✅ USE: pl_xero

BALANCE SHEET (assets, liabilities):
✅ USE: bs_xero

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUERY RULES:
✅ ALWAYS use ILIKE for name matching
✅ Use parameterized queries ($1, $2)
✅ Use SUM() for totals, COUNT() for counts
❌ NEVER say "I don't have access" - Query the database!

Remember: You HAVE the data. Query it immediately!
`;
  },

  /**
   * 🆓 FREE SEARCH PROMPT - Only when query needs search
   */
  SEARCH: () => `
═══════════════════════════════════════════════════════════════
INTERNET SEARCH TOOLS (FREE)
═══════════════════════════════════════════════════════════════

You have access to FREE internet search powered by DuckDuckGo and Invidious.

Available tools:
1. web_search - Search for text and images
2. news_search - Find recent news articles  
3. video_search - Find YouTube videos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN TO USE SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use search tools when user:
✅ Explicitly asks to "search" or "look up"
✅ Asks about current events or recent information
✅ Requests images or visual content
✅ Asks factual questions you're unsure about
✅ Wants to find tutorials or how-to videos
✅ Needs verification of information

Examples:
- "Search for best coffee shops in Tokyo" → web_search
- "What's the latest tech news?" → news_search
- "Show me pictures of mountains" → web_search (search_type: images)
- "Find Python tutorials" → video_search

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEARCH TOOL PARAMETERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

web_search:
- query: Search query string (required)
- search_type: "general" (text+images), "text" (text only), "images" (images only)
- count: Number of results (1-20, default: 5)

news_search:
- query: News search query (required)
- freshness: "pd" (past day), "pw" (past week), "pm" (past month)
- count: Number of articles (1-20, default: 5)

video_search:
- query: Video search query (required)
- count: Number of videos (1-20, default: 5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEARCH BEST PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Use specific, clear search queries
✅ Choose appropriate search type
✅ For images: be descriptive ("sunset over mountains")
✅ For news: add time context if needed
✅ For videos: include "tutorial", "how to", etc.

RESPONSE FORMAT:
1. Present results clearly with titles and URLs
2. For images: mention thumbnails are available
3. For news: highlight publication dates
4. For videos: include duration and channel
5. Summarize key findings briefly
6. Offer to search for more specific information

Example response:
"I found several articles about AI developments:

1. **GPT-5 Released** (TechCrunch)
   Major improvements in reasoning...
   [url]

2. **DeepMind Breakthrough** (Nature)
   AlphaFold 3 achieves...
   [url]

Would you like more details on any of these?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Remember: This is a FREE service using DuckDuckGo - no API keys needed!
`
};

/**
 * PromptDetector - Determines which prompts and tools are needed
 */
export class PromptDetector {
  /**
   * Detect if query needs location/maps tools
   */
  static needsLocationTools(message) {
    const keywords = [
      'near', 'nearby', 'close', 'find', 'where', 'map', 'maps',
      'directions', 'route', 'how far', 'distance', 'how long',
      'gym', 'restaurant', 'cafe', 'coffee', 'food', 'eat',
      'hospital', 'atm', 'bank', 'hotel', 'pharmacy', 'store',
      'gas station', 'parking', 'mall', 'shop', 'shopping',
      'navigate', 'drive', 'walk', 'get to', 'go to'
    ];
    
    const lowerMessage = message.toLowerCase();
    return keywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Detect if query needs email/contact tools
   */
  static needsEmailTools(message) {
    const keywords = [
      'email', 'send', 'contact', 'message', 'write to',
      'reach out', 'mail', 'send to', 'notify', 'inform',
      'tell', 'let know', 'communicate', 'correspondence'
    ];
    
    const lowerMessage = message.toLowerCase();
    return keywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Detect if query needs calendar tools
   */
  static needsCalendarTools(message) {
    const keywords = [
      'meeting', 'event', 'schedule', 'calendar', 'appointment',
      'book', 'remind', 'tomorrow', 'next week', 'next month',
      'invite', 'set up', 'plan', 'arrange', 'organize',
      'reschedule', 'cancel', 'delete event', 'upcoming',
      'today', 'this week', 'this month'
    ];
    
    const lowerMessage = message.toLowerCase();
    return keywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Detect if query needs database tools
   */
  static needsDatabaseTools(message) {
    const keywords = [
      // Query verbs
      'show', 'show me', 'get', 'find', 'search', 'list', 'display',
      'give me', 'tell me', 'what', 'which', 'who', 'where',
      
      // Data indicators
      'data', 'records', 'entries', 'database', 'table',
      
      // Business entities
      'customer', 'order', 'invoice', 'sales', 'product',
      'transaction', 'payment', 'purchase', 'item', 'store',
      'supplier', 'vendor', 'client', 'user', 'account',
      
      // Metrics/aggregations
      'how many', 'how much', 'count', 'total', 'sum', 'average',
      'revenue', 'cost', 'price', 'amount', 'spend', 'spent',
      'pay', 'paid', 'charge', 'charged',
      
      // Time-based queries
      'last', 'recent', 'yesterday', 'this month', 'this year',
      'between', 'from', 'to', 'since', 'until',
      
      // Filters
      'filter', 'where', 'with', 'for', 'by', 'in', 'at'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    // Check for keywords
    const hasKeyword = keywords.some(kw => lowerMessage.includes(kw));
    
    // Additional check: looks like a query pattern?
    const queryPatterns = [
      /how (much|many)/i,
      /what (is|are|was|were|did)/i,
      /show (me|all|my)/i,
      /get (me|all|my)/i,
      /find (me|all|my)/i,
      /(total|sum|count|average) (of|for)/i,
      /paid (to|for|at)/i,
      /spent (on|at|for)/i
    ];
    
    const matchesPattern = queryPatterns.some(pattern => pattern.test(message));
    
    return hasKeyword || matchesPattern;
  }

  /**
   * 🆓 Detect if query needs FREE search tools
   */
  static needsSearchTools(message) {
    const keywords = [
      'search', 'look up', 'find information', 'search for',
      'google', 'what is', 'who is', 'when did', 'where is',
      'latest', 'recent', 'current', 'news', 'trending',
      'show me', 'find me', 'images of', 'pictures of',
      'photos of', 'videos of', 'video of',
      'how to', 'tutorial', 'learn about', 'explain'
    ];
    
    const lowerMessage = message.toLowerCase();
    return keywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Filter tools based on what's needed
   */
  static filterRelevantTools(
    allTools, 
    message, 
    needsLocation, 
    needsEmail, 
    needsCalendar, 
    needsDatabase,
    needsSearch // 🆓 FREE search parameter
  ) {
    const alwaysInclude = ['check_google_connection'];
    
    const locationTools = [
      'weather', 'search_places', 'get_directions',
      'get_place_details', 'calculate_distance', 'nearby_search'
    ];
    
    const emailTools = ['search_contact', 'send_email'];
    
    const calendarTools = [
      'create_calendar_event', 'list_calendar_events',
      'update_calendar_event', 'delete_calendar_event'
    ];
    
    const databaseTools = ['execute_query'];

    // 🆓 FREE search tools
    const searchTools = ['web_search', 'news_search'];
    
    return allTools.filter(tool => {
      const toolName = tool.function.name;
      
      if (alwaysInclude.includes(toolName)) return true;
      if (needsLocation && locationTools.includes(toolName)) return true;
      if (needsEmail && emailTools.includes(toolName)) return true;
      if (needsCalendar && calendarTools.includes(toolName)) return true;
      if (needsDatabase && databaseTools.includes(toolName)) return true;
      if (needsSearch && searchTools.includes(toolName)) return true; // 🆓
      
      return false;
    });
  }
}