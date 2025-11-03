// src/services/config/tool-config.js
/**
 * Tool Configuration Manager
 * Centralized configuration for which tools require which parameters
 */

export class ToolConfig {
  /**
   * Tools that require user_id injection
   */
  static TOOLS_REQUIRING_USER_ID = [
    'create_calendar_event',
    'list_calendar_events',
    'update_calendar_event',
    'delete_calendar_event',
    'check_google_connection',
    'search_contact',
    'send_email',
    'list_data_sources',
    'get_schema_structure',
    'execute_sql_query',
    'get_quick_analytics'
  ];

  /**
   * Tools that require user_location injection
   */
  static TOOLS_REQUIRING_LOCATION = [
    'weather',
    'search_places',
    'get_directions',
    'get_place_details',
    'calculate_distance',
    'nearby_search'
  ];

  /**
   * Read-only tools that don't require confirmation
   */
  static READ_ONLY_TOOLS = [
    'search_contact',
    'list_calendar_events',
    'weather',
    'check_google_connection',
    'search_places',
    'get_directions',
    'get_place_details',
    'calculate_distance',
    'nearby_search',
    'list_data_sources',
    'get_schema_structure',
    'execute_sql_query',
    'get_quick_analytics'
  ];

  /**
   * Tools that require explicit user confirmation
   */
  static CONFIRMATION_REQUIRED_TOOLS = [
    'send_email',
    'create_calendar_event',
    'update_calendar_event',
    'delete_calendar_event'
  ];

  /**
   * Check if tool requires user_id
   */
  static requiresUserId(toolName) {
    return this.TOOLS_REQUIRING_USER_ID.includes(toolName);
  }

  /**
   * Check if tool requires location
   */
  static requiresLocation(toolName) {
    return this.TOOLS_REQUIRING_LOCATION.includes(toolName);
  }

  /**
   * Check if tool is read-only
   */
  static isReadOnly(toolName) {
    return this.READ_ONLY_TOOLS.includes(toolName);
  }

  /**
   * Check if tool requires confirmation
   */
  static requiresConfirmation(toolName) {
    return this.CONFIRMATION_REQUIRED_TOOLS.includes(toolName);
  }

  /**
   * Inject required parameters into tool arguments
   */
  static injectParameters(toolName, args, { user_id, user_location }) {
    const injectedArgs = { ...args };

    // Inject user_id if needed
    if (this.requiresUserId(toolName) && user_id) {
      injectedArgs.user_id = user_id;
    }

    // Inject user_location if needed
    if (this.requiresLocation(toolName) && user_location) {
      injectedArgs.user_location = user_location;
      console.log(`📍 Injected user_location for ${toolName}`);
    }

    return injectedArgs;
  }
}