// src/services/prompts/sections/time-prompt.js
/**
 * Time and timezone information prompt
 */

export function getTimePrompt({ timezone, timeInfo, locationInfo }) {
  return `
Current date and time information:
- Date: ${timeInfo.localDate}
- Time: ${timeInfo.localTime}
- Timezone: ${timezone}
- ISO format: ${timeInfo.iso}${locationInfo || ''}

When user mentions relative times, calculate from the current date/time above.
`;
}