// src/mcp-server/index.js - SECURE VERSION WITH ACCESS CONTROL
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Existing imports
import { weatherTool } from './tools/weather.tool.js';
import { 
  createCalendarEventTool, 
  listCalendarEventsTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  checkGoogleConnectionTool
} from './tools/calendar.tool.js';
import { searchContactTool } from './tools/contact.tool.js';
import { sendEmailTool } from './tools/email.tool.js';

// Google Maps
import { googleMapsTools } from './tools/maps.tools.js';
import { googleMapsHandlers } from './handlers/maps.handlers.js';

// ⭐ SECURE DATABASE TOOLS with access verification
import { 
  getUserSchemasTool,
  getEnhancedSchemaStructureTool,
  executeSQLQueryTool,
  getQuickAnalyticsTool
} from './tools/enhanced-dynamic-query.tool.js';

// Create MCP server
const server = new Server({
  name: 'multi-tool-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define all tools
const TOOLS = [
  {
    name: 'weather',
    description: 'Get the current weather for a given location. Can use user location if no location specified.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { 
          type: 'string', 
          description: 'Location to get the weather for (e.g., "Bali", "London"). Optional if user_location is provided.' 
        }
      }
    }
  },
  {
    name: 'search_contact',
    description: 'Search for a contact email address by searching through Gmail history. Finds people the user has emailed with. Use this when you need to find someone\'s email address.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Name of person to search for (e.g., "fitrah", "john smith", "geri")'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail. Use search_contact tool first to find recipient email addresses by name. Emails are sent immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipient email addresses. Use search_contact first if you only have names.'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content. Write professional, clear, and context-appropriate content.'
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'CC recipient email addresses (optional)'
        },
        bcc: {
          type: 'array',
          items: { type: 'string' },
          description: 'BCC recipient email addresses (optional)'
        },
        html: {
          type: 'boolean',
          description: 'Whether body content is HTML formatted (optional, default: false)',
          default: false
        },
        replyTo: {
          type: 'string',
          description: 'Gmail message ID to reply to for threading (optional)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'check_google_connection',
    description: 'Check if Google Calendar is connected and working.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new event in Google Calendar. Use the detected timezone from system context.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description (optional)' },
        startDateTime: { 
          type: 'string', 
          description: 'Start date and time in ISO 8601 format (e.g., 2025-10-29T14:00:00)' 
        },
        endDateTime: { 
          type: 'string', 
          description: 'End date and time in ISO 8601 format (e.g., 2025-10-29T15:00:00)' 
        },
        timeZone: { 
          type: 'string', 
          description: 'Time zone (use the timezone from system message)',
          default: 'Asia/Makassar'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of attendee email addresses (optional). Use search_contact tool first if you need to find email addresses by name.'
        }
      },
      required: ['summary', 'startDateTime', 'endDateTime']
    }
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming events from Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of events to return',
          default: 10
        },
        timeMin: { 
          type: 'string', 
          description: 'Lower bound for event start time (ISO 8601 format)'
        }
      }
    }
  },
  {
    name: 'update_calendar_event',
    description: 'Update an existing Google Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to update' },
        summary: { type: 'string', description: 'New event title/summary' },
        description: { type: 'string', description: 'New event description' },
        startDateTime: { type: 'string', description: 'New start date/time (ISO 8601)' },
        endDateTime: { type: 'string', description: 'New end date/time (ISO 8601)' },
        timeZone: { type: 'string', default: 'Asia/Makassar' },
        attendees: { type: 'array', items: { type: 'string' } }
      },
      required: ['eventId']
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a Google Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to delete' }
      },
      required: ['eventId']
    }
  },

  // ⭐ SECURE DATABASE TOOLS WITH ACCESS CONTROL
  {
    name: 'list_data_sources',
    description: '🔐 ALWAYS call this FIRST when user asks about revenue, expenses, profit, or any financial data. Returns list of data sources (schemas) that user has permission to access. Each schema represents a different company/client database.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  {
    name: 'get_schema_structure',
    description: '🔐 CALL THIS SECOND after list_data_sources. Verifies user access and returns table structure, columns, sample data, AND custom query instructions if available. CRITICAL: Always check "has_access" field - if false, user cannot query this schema.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name from list_data_sources (e.g., "xero_client_a")'
        }
      },
      required: ['schema_name']
    }
  },

  {
    name: 'list_query_patterns',
    description: '⭐ NEW: List available pre-built query patterns for a schema. Use this to discover shortcuts like "revenue_by_customer", "outstanding_invoices", "cash_flow". These are tested, optimized queries for common business questions.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name to check for patterns'
        }
      },
      required: ['schema_name']
    }
  },

  {
    name: 'get_query_pattern',
    description: '⭐ NEW: Get a specific pre-built query pattern. Returns ready-to-use SQL for common queries. You can modify the pattern (add WHERE clauses, change date ranges, etc.) before executing.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name'
        },
        pattern_name: {
          type: 'string',
          description: 'Pattern name from list_query_patterns (e.g., "revenue_by_customer")'
        }
      },
      required: ['schema_name', 'pattern_name']
    }
  },

  {
    name: 'execute_sql_query',
    description: '🔐 SECURE: Execute SQL query with automatic access verification. CALL THIS THIRD after confirming schema access. User permissions are verified before executing ANY query. Returns query results or ACCESS_DENIED error. Only SELECT queries allowed.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name to query (must match schema from get_schema_structure)'
        },
        sql_query: {
          type: 'string',
          description: 'SQL SELECT query to execute. Must be valid SQL for the schema. Example: "SELECT SUM(total) FROM invoices WHERE date >= \'2024-01-01\'"'
        }
      },
      required: ['schema_name', 'sql_query']
    }
  },

  {
    name: 'get_quick_analytics',
    description: '🔐 SECURE: Get predefined analytics with access verification. Faster than execute_sql_query for common metrics. Available metrics: total_revenue, total_expenses, customer_count. Access is verified automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name to query'
        },
        metric: {
          type: 'string',
          enum: ['total_revenue', 'total_expenses', 'customer_count'],
          description: 'Predefined metric to calculate'
        }
      },
      required: ['schema_name', 'metric']
    }
  },
  
  ...googleMapsTools
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {
  weather: async (args) => {
    const { location, user_location } = args;
    
    if (user_location) {
      console.error(`⚡ MCP: Executing weather tool with user location: ${user_location.lat}, ${user_location.lng}`);
    } else if (location) {
      console.error(`⚡ MCP: Executing weather tool for location: ${location}`);
    } else {
      console.error(`⚡ MCP: Executing weather tool without location`);
    }
    
    const result = await weatherTool({ location, user_location });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  search_contact: async (args) => {
    const { name, user_id } = args;
    console.error(`⚡ MCP: Searching contact "${name}" for user: ${user_id}`);
    
    const result = await searchContactTool({ 
      userId: user_id, 
      name 
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  send_email: async (args) => {
    const { user_id, to, subject, body, cc, bcc, html, replyTo } = args;
    console.error(`⚡ MCP: Sending email for user: ${user_id}`);
    console.error(`   To: ${to?.join(', ')}`);
    console.error(`   Subject: ${subject}`);
    
    const result = await sendEmailTool({
      userId: user_id,
      to,
      subject,
      body,
      cc,
      bcc,
      html,
      replyTo
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  check_google_connection: async (args) => {
    console.error(`⚡ MCP: Checking Google connection for user: ${args.user_id}`);
    const result = await checkGoogleConnectionTool({ userId: args.user_id });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  create_calendar_event: async (args) => {
    console.error(`⚡ MCP: Creating calendar event for user: ${args.user_id}`);
    const { user_id, user_location, ...eventData } = args;
    const result = await createCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  list_calendar_events: async (args) => {
    console.error(`⚡ MCP: Listing calendar events for user: ${args.user_id}`);
    const { user_id, user_location, ...queryData } = args;
    const result = await listCalendarEventsTool({ 
      userId: user_id, 
      ...queryData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  update_calendar_event: async (args) => {
    console.error(`⚡ MCP: Updating calendar event for user: ${args.user_id}`);
    const { user_id, user_location, ...eventData } = args;
    const result = await updateCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  delete_calendar_event: async (args) => {
    console.error(`⚡ MCP: Deleting calendar event for user: ${args.user_id}`);
    const { user_id, user_location, ...eventData } = args;
    const result = await deleteCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  // ⭐ SECURE DATABASE HANDLERS WITH ACCESS CONTROL
  list_data_sources: async (args) => {
    const { user_id } = args;
    console.error(`⚡ MCP: Listing data sources for user: ${user_id}`);
    const result = await getUserSchemasTool({ userId: user_id });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  get_schema_structure: async (args) => {
    const { user_id, schema_name } = args;
    console.error(`⚡ MCP: 🔐 Verifying access and getting schema: ${schema_name}`);
    
    const result = await getEnhancedSchemaStructureTool({
      userId: user_id,
      schemaName: schema_name
    });
    
    // Log access result
    if (result.has_access) {
      console.error(`✅ Access granted: ${user_id} → ${schema_name}`);
    } else {
      console.error(`❌ Access denied: ${user_id} → ${schema_name}`);
    }
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  execute_sql_query: async (args) => {
    const { user_id, schema_name, sql_query } = args;
    console.error(`⚡ MCP: 🔐 Executing query with access verification`);
    console.error(`   User: ${user_id}, Schema: ${schema_name}`);
    
    const result = await executeSQLQueryTool({
      userId: user_id,
      schemaName: schema_name,
      sqlQuery: sql_query
    });
    
    if (!result.has_access) {
      console.error(`❌ Query blocked: User ${user_id} lacks access to ${schema_name}`);
    } else if (result.success) {
      console.error(`✅ Query executed: ${result.row_count} rows returned`);
    } else {
      console.error(`⚠️ Query failed: ${result.error}`);
    }
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  get_quick_analytics: async (args) => {
    const { user_id, schema_name, metric } = args;
    console.error(`⚡ MCP: 🔐 Getting analytics: ${metric} from ${schema_name}`);
    
    const result = await getQuickAnalyticsTool({
      userId: user_id,
      schemaName: schema_name,
      metric: metric
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },
  
  
  ...googleMapsHandlers
};

// Handle tools/call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const handler = toolHandlers[name];
    
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return await handler(args);
    
  } catch (error) {
    console.error(`❌ MCP: Tool execution error for ${name}:`, error);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          error: error.message,
          code: error.code 
        })
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ MCP Server started with SECURE database access control');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});