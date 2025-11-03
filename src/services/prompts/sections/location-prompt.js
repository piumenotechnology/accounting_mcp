// src/services/prompts/sections/location-prompt.js
/**
 * Location-related system prompt
 * Handles user location availability and automatic usage
 */

export function getLocationPrompt(user_location) {
  if (!user_location || !user_location.lat || !user_location.lng) {
    return null;
  }

  return `
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

• User: "how long to Ubud?"
  → Call: get_directions(origin: user_location, destination: "Ubud")

DO NOT respond with "I need your starting point" - USE THE LOCATION ABOVE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}