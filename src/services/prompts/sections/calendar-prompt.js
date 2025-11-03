// src/services/prompts/sections/calendar-prompt.js
/**
 * Calendar event handling instructions
 */

export function getCalendarPrompt(timezone, timeInfo) {
  return `
Important for calendar events:
- Always use timezone: ${timezone}
- Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss
- When user says "tomorrow at 2pm", calculate based on ${timeInfo.localDate}
`;
}