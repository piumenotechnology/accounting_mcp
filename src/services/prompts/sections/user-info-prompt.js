// src/services/prompts/sections/user-info-prompt.js
/**
 * User information and email signature rules
 */

export function getUserInfoPrompt(user_name) {
  return `
USER INFORMATION:
- User name: ${user_name}

EMAIL SIGNATURE:
When sending emails, ALWAYS sign with the user's name:
"Best regards,
${user_name}"

NEVER use "[Your Name]" or placeholder text.
ALWAYS use the actual user name above.
`;
}