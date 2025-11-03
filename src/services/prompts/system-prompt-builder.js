// src/services/prompts/system-prompt-builder.js
/**
 * System Prompt Builder
 * Assembles the complete system message from modular components
 */

import { getLocationPrompt } from './sections/location-prompt.js';
import { getTimePrompt } from './sections/time-prompt.js';
import { getUserInfoPrompt } from './sections/user-info-prompt.js';
import { getMapToolsPrompt } from './sections/map-tools-prompt.js';
import { getCalendarPrompt } from './sections/calendar-prompt.js';
import { getConfirmationPrompt } from './sections/confirmation-prompt.js';
import { getDatabaseSecurityPrompt } from './sections/database-security-prompt.js';
import { getReadOnlyOperationsPrompt } from './sections/read-only-operations-prompt.js';

export class SystemPromptBuilder {
  constructor() {
    this.sections = [];
  }

  /**
   * Build complete system message with all sections
   */
  build({
    user_location,
    timezone,
    timeInfo,
    user_name,
    locationInfo
  }) {
    const sections = [
      // Location section (if available)
      user_location ? getLocationPrompt(user_location) : null,

      // Time and timezone information
      getTimePrompt({ timezone, timeInfo, locationInfo }),

      // User information
      getUserInfoPrompt(user_name),

      // Google Maps tools section (if location available)
      user_location ? getMapToolsPrompt(user_location) : this._getMapToolsNoLocation(),

      // Calendar tools section
      getCalendarPrompt(timezone, timeInfo),

      // Two-step confirmation system
      getConfirmationPrompt(),

      // Database security and access control
      getDatabaseSecurityPrompt(),

      // Read-only operations list
      getReadOnlyOperationsPrompt()
    ];

    // Filter out null sections and join
    const content = sections
      .filter(section => section !== null && section !== '')
      .join('\n\n');

    return {
      role: 'system',
      content
    };
  }

  /**
   * Helper for maps prompt when no location
   */
  _getMapToolsNoLocation() {
    return `
═══════════════════════════════════════════════════════════════
GOOGLE MAPS TOOLS
═══════════════════════════════════════════════════════════════

⚠️ User location not provided - ask for it if needed for maps queries.

Available tools:
1. search_places - Find restaurants, cafes, ATMs, hotels, hospitals, etc.
2. get_directions - Get route with turn-by-turn instructions and traffic
3. get_place_details - Get hours, phone, reviews, photos for a place
4. calculate_distance - Quick distance/time between two points
5. nearby_search - Discover top-rated places near a location

When user asks location-based questions, ask for their location first.
═══════════════════════════════════════════════════════════════
`;
  }
}