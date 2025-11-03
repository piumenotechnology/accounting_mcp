// src/services/prompts/sections/read-only-operations-prompt.js
/**
 * List of operations that don't require confirmation
 */

export function getReadOnlyOperationsPrompt() {
  return `
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
- execute_sql_query (read-only queries)
- get_quick_analytics (read-only analytics)

Execute these immediately without confirmation.
`;
}