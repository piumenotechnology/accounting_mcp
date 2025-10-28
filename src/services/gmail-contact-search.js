import { google } from 'googleapis';
import Fuse from 'fuse.js';
import { withAutoRetry } from './google-connection.js';

export async function searchContactInGmail(userId, name) {
  try {
    if (!name || name.trim().length < 2) {
      return {
        success: false,
        error: 'Search name must be at least 2 characters'
      };
    }

    console.log(`🔍 Searching Gmail for contact: "${name}" (user: ${userId})`);

    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      // Build search query
      const searchQuery = `from:${name} OR to:${name}`;
      
      // Search Gmail messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 50 // Get enough for good analysis
      });

      const messages = response.data.messages || [];

      if (messages.length === 0) {
        console.log(`❌ No emails found for: ${name}`);
        return {
          success: false,
          error: `No contact found with name "${name}" in email history`,
          suggestion: 'Please provide the email address directly or try a different name'
        };
      }

      console.log(`📧 Found ${messages.length} emails, extracting contacts...`);

      // Extract contact information from messages
      const contacts = await extractContactsFromMessages(gmail, messages, name);

      if (contacts.length === 0) {
        return {
          success: false,
          error: `Could not extract email addresses for "${name}"`,
          suggestion: 'Please provide the email address directly'
        };
      }

      // Rank contacts by relevance
      const rankedContacts = rankContacts(contacts, name);

      // Return results based on confidence
      if (rankedContacts.length === 1 || rankedContacts[0].confidence === 'high') {
        // Single high-confidence match
        console.log(`✅ Found contact: ${rankedContacts[0].email}`);
        return {
          success: true,
          match: rankedContacts[0]
        };
      } else {
        // Multiple matches - let AI decide
        console.log(`⚠️ Found ${rankedContacts.length} potential matches`);
        return {
          success: true,
          matches: rankedContacts.slice(0, 3), // Top 3 matches
          message: `Found ${rankedContacts.length} contacts named "${name}". Please specify which one.`
        };
      }
    });

  } catch (error) {
    console.error('❌ Gmail contact search error:', error.message);
    
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      return {
        success: false,
        error: 'Gmail not connected. Please reconnect your Google account.'
      };
    }

    return {
      success: false,
      error: `Failed to search Gmail: ${error.message}`
    };
  }
}

async function extractContactsFromMessages(gmail, messages, searchName) {
  const contactMap = new Map(); // Use Map to deduplicate by email

  // Process messages in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (message) => {
        try {
          const details = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Date', 'Subject']
          });

          const headers = details.data.payload.headers;
          const date = headers.find(h => h.name === 'Date')?.value;
          const from = headers.find(h => h.name === 'From')?.value;
          const to = headers.find(h => h.name === 'To')?.value;

          // Parse email addresses from From and To fields
          const fromEmails = parseEmailAddresses(from || '');
          const toEmails = parseEmailAddresses(to || '');

          // Combine all emails
          const allEmails = [...fromEmails, ...toEmails];

          // Add to contact map
          allEmails.forEach(({ email, displayName }) => {
            if (email && email.includes('@')) {
              if (!contactMap.has(email)) {
                contactMap.set(email, {
                  email,
                  displayName: displayName || email,
                  emailCount: 0,
                  lastContact: null,
                  firstContact: null,
                  source: 'gmail'
                });
              }

              const contact = contactMap.get(email);
              contact.emailCount++;

              const messageDate = new Date(date);
              if (!contact.lastContact || messageDate > new Date(contact.lastContact)) {
                contact.lastContact = messageDate.toISOString();
              }
              if (!contact.firstContact || messageDate < new Date(contact.firstContact)) {
                contact.firstContact = messageDate.toISOString();
              }
            }
          });

        } catch (error) {
          console.error(`Failed to get message ${message.id}:`, error.message);
        }
      })
    );
  }

  const contacts = Array.from(contactMap.values());
  console.log(`📊 Extracted ${contacts.length} unique contacts`);

  // Filter contacts that match the search name
  return filterContactsByName(contacts, searchName);
}

function parseEmailAddresses(headerValue) {
  if (!headerValue) return [];

  const results = [];
  
  // Match patterns like: "Name <email@example.com>" or just "email@example.com"
  const emailRegex = /(?:"?([^"<]*)"?\s*)?<?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)>?/g;
  
  let match;
  while ((match = emailRegex.exec(headerValue)) !== null) {
    const displayName = match[1]?.trim() || '';
    const email = match[2]?.trim().toLowerCase();
    
    if (email) {
      results.push({ email, displayName });
    }
  }

  return results;
}

function filterContactsByName(contacts, searchName) {
  const fuse = new Fuse(contacts, {
    keys: ['displayName', 'email'],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    includeScore: true,
    minMatchCharLength: 2
  });

  const results = fuse.search(searchName);
  
  return results.map(result => result.item);
}

function rankContacts(contacts, searchName) {
  const now = new Date();

  return contacts
    .map(contact => {
      // Calculate recency score (0-100)
      const lastContactDate = new Date(contact.lastContact);
      const daysSinceContact = Math.floor((now - lastContactDate) / (1000 * 60 * 60 * 24));
      
      let recencyScore = 100;
      if (daysSinceContact > 7) recencyScore = 80;
      if (daysSinceContact > 30) recencyScore = 60;
      if (daysSinceContact > 90) recencyScore = 40;
      if (daysSinceContact > 180) recencyScore = 20;

      // Calculate frequency score (0-100)
      let frequencyScore = 20;
      if (contact.emailCount >= 50) frequencyScore = 100;
      else if (contact.emailCount >= 20) frequencyScore = 80;
      else if (contact.emailCount >= 10) frequencyScore = 60;
      else if (contact.emailCount >= 5) frequencyScore = 40;

      // Calculate name match score (0-100)
      const nameLower = contact.displayName.toLowerCase();
      const searchLower = searchName.toLowerCase();
      let nameMatchScore = 0;
      
      if (nameLower.includes(searchLower)) {
        nameMatchScore = 100;
      } else if (searchLower.includes(nameLower)) {
        nameMatchScore = 80;
      } else {
        // Partial word match
        const nameWords = nameLower.split(/\s+/);
        const searchWords = searchLower.split(/\s+/);
        const matchingWords = nameWords.filter(word => 
          searchWords.some(sw => word.includes(sw) || sw.includes(word))
        );
        nameMatchScore = (matchingWords.length / nameWords.length) * 60;
      }

      // Calculate overall score
      const totalScore = (recencyScore * 0.5) + (frequencyScore * 0.3) + (nameMatchScore * 0.2);

      // Determine confidence level
      let confidence = 'low';
      if (totalScore >= 80 && nameMatchScore >= 80) confidence = 'high';
      else if (totalScore >= 60) confidence = 'medium';

      return {
        email: contact.email,
        displayName: contact.displayName,
        confidence,
        score: Math.round(totalScore),
        metadata: {
          lastContact: contact.lastContact,
          emailCount: contact.emailCount,
          source: 'gmail',
          daysSinceContact
        }
      };
    })
    .sort((a, b) => b.score - a.score); // Sort by score descending
}