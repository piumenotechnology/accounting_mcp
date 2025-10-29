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
    
    // ⭐ Check if it looks like an email address or username
    const looksLikeEmail = name.includes('@') || /^[a-z0-9._-]+$/i.test(name);
    
    if (looksLikeEmail && name.includes('@')) {
      // Full email address provided - search for exact match
      console.log(`   📧 Looks like full email address, searching for exact match`);
    } else if (looksLikeEmail && !name.includes('@')) {
      // Username without domain (e.g., "fitrahrr")
      console.log(`   👤 Looks like email username (no @), searching email addresses`);
    } else {
      // Regular name search
      console.log(`   👤 Looks like person name, searching names and emails`);
    }

    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      // Build search query
      const searchQuery = `from:${name} OR to:${name}`;
      
      // Search Gmail messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 50
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

      // ⭐ Check if we have any high-confidence matches
      const highConfidenceMatches = rankedContacts.filter(c => 
        c.confidence === 'high' && c.score >= 70
      );

      // ⭐ If no high-confidence match, suggest alternatives
      if (highConfidenceMatches.length === 0 && rankedContacts.length > 0) {
        console.log(`⚠️ No high-confidence match for "${name}"`);
        
        const possibleNames = rankedContacts.slice(0, 3).map(c => c.displayName);
        
        return {
          success: false,
          noCloseMatch: true,
          error: `No close match found for "${name}"`,
          possibleMatches: possibleNames,
          suggestion: `Did you mean one of these: ${possibleNames.join(', ')}? Or please provide the exact email address.`
        };
      }

      // ⭐ Always return all matches if more than one high-confidence
      if (highConfidenceMatches.length > 1 || rankedContacts.length > 1) {
        console.log(`⚠️ Found ${rankedContacts.length} contacts - disambiguation required`);
        
        // Add index to each contact for easy selection
        const indexedContacts = rankedContacts.slice(0, 5).map((contact, idx) => ({
          index: idx + 1,
          email: contact.email,
          displayName: contact.displayName,
          confidence: contact.confidence,
          metadata: contact.metadata,
          recommended: idx === 0 // First one is recommended
        }));

        return {
          success: true,
          requiresDisambiguation: true, // ⭐ Flag that user needs to pick
          matches: indexedContacts,
          message: `Found ${indexedContacts.length} contacts matching "${name}". Please specify which one.`,
          searchName: name
        };
      } else {
        // Single match - still needs confirmation but no disambiguation
        console.log(`✅ Found single contact: ${rankedContacts[0].email}`);
        return {
          success: true,
          requiresDisambiguation: false,
          match: {
            email: rankedContacts[0].email,
            displayName: rankedContacts[0].displayName,
            confidence: rankedContacts[0].confidence,
            metadata: rankedContacts[0].metadata
          }
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
  const contactMap = new Map();

  // Process messages in batches
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

          const fromEmails = parseEmailAddresses(from || '');
          const toEmails = parseEmailAddresses(to || '');
          const allEmails = [...fromEmails, ...toEmails];

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

  return filterContactsByName(contacts, searchName);
}

function parseEmailAddresses(headerValue) {
  if (!headerValue) return [];

  const results = [];
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
  const searchLower = searchName.toLowerCase().trim();
  const searchLength = searchName.length;
  
  // Check if search looks like email username (alphanumeric with dots/underscores)
  const looksLikeUsername = /^[a-z0-9._-]+$/i.test(searchName) && searchName.length >= 5;
  
  // STEP 1: Try exact/substring matches first (no fuzzy)
  const exactMatches = contacts.filter(contact => {
    const nameLower = contact.displayName.toLowerCase();
    const emailLower = contact.email.toLowerCase();
    const emailUsername = emailLower.split('@')[0]; // Part before @
    
    // If search looks like email username, prioritize email matches
    if (looksLikeUsername) {
      // Exact email username match
      if (emailUsername === searchLower) {
        return true;
      }
      // Email username starts with search (must be significant - at least 80% of username)
      if (emailUsername.startsWith(searchLower) && searchLower.length >= emailUsername.length * 0.8) {
        return true;
      }
      // Don't match name for username-like searches
      return false;
    }
    
    // Regular name search with strict rules
    // Rule 1: Exact match
    if (nameLower === searchLower || emailLower === searchLower) {
      return true;
    }
    
    // Rule 2: Word-level match (must match complete words)
    const nameWords = nameLower.split(/\s+/);
    const hasWordMatch = nameWords.some(word => {
      // Exact word match
      if (word === searchLower) return true;
      
      // Word starts with search (but search must be at least 60% of word length)
      if (word.startsWith(searchLower) && searchLower.length >= word.length * 0.6) {
        return true;
      }
      
      return false;
    });
    
    if (hasWordMatch) return true;
    
    // Rule 3: Email starts with search (must be significant portion)
    if (emailUsername.startsWith(searchLower) && searchLower.length >= 4) {
      return true;
    }
    
    // Rule 4: Name contains search as complete substring (not just any substring)
    // Only if search is reasonably long (4+ chars) and appears as standalone
    if (searchLength >= 4) {
      // Check if search appears with word boundaries
      const regex = new RegExp(`\\b${searchLower}`, 'i');
      if (regex.test(nameLower)) {
        return true;
      }
    }
    
    return false;
  });
  
  if (exactMatches.length > 0) {
    console.log(`   ✅ Word/exact matches: "${searchName}" → ${exactMatches.length} matches`);
    return exactMatches;
  }
  
  // If search looks like username but no match, don't fuzzy search
  if (looksLikeUsername) {
    console.log(`   ⚠️ No exact match for username-like search: "${searchName}"`);
    return [];
  }
  
  // STEP 2: Only use fuzzy for NAME searches with reasonable length
  if (searchName.length < 4) {
    console.log(`   ⚠️ Search term too short for fuzzy: "${searchName}"`);
    return [];
  }
  
  // ⭐ VERY strict fuzzy matching as fallback - only for display names
  const fuse = new Fuse(contacts, {
    keys: [
      { name: 'displayName', weight: 1.0 }
    ],
    threshold: 0.15, // ← EXTREMELY strict! (was 0.2)
    includeScore: true,
    minMatchCharLength: Math.max(4, Math.floor(searchName.length * 0.8)), // ← Match at least 80% of search
    ignoreLocation: false,
    distance: 20, // ← Very close characters only (was 30)
    findAllMatches: false
  });

  const results = fuse.search(searchName);
  
  // Only return excellent fuzzy matches
  const goodMatches = results
    .filter(result => {
      // Score must be very good (< 0.2)
      if (result.score >= 0.2) return false;
      
      // Name must have substantial overlap with search
      const nameLower = result.item.displayName.toLowerCase();
      const commonChars = [...searchLower].filter(char => nameLower.includes(char)).length;
      const overlapRatio = commonChars / searchLower.length;
      
      // Require at least 80% character overlap
      return overlapRatio >= 0.8;
    })
    .map(result => result.item);
  
  console.log(`   🔍 Fuzzy search: "${searchName}" → ${goodMatches.length} matches (${results.length} total, ${results.length - goodMatches.length} rejected)`);
  
  return goodMatches;
}

function rankContacts(contacts, searchName) {
  const now = new Date();

  return contacts
    .map(contact => {
      // Recency score
      const lastContactDate = new Date(contact.lastContact);
      const daysSinceContact = Math.floor((now - lastContactDate) / (1000 * 60 * 60 * 24));
      
      let recencyScore = 100;
      if (daysSinceContact > 7) recencyScore = 80;
      if (daysSinceContact > 30) recencyScore = 60;
      if (daysSinceContact > 90) recencyScore = 40;
      if (daysSinceContact > 180) recencyScore = 20;

      // Frequency score
      let frequencyScore = 20;
      if (contact.emailCount >= 50) frequencyScore = 100;
      else if (contact.emailCount >= 20) frequencyScore = 80;
      else if (contact.emailCount >= 10) frequencyScore = 60;
      else if (contact.emailCount >= 5) frequencyScore = 40;

      // Name match score
      const nameLower = contact.displayName.toLowerCase();
      const searchLower = searchName.toLowerCase();
      let nameMatchScore = 0;
      
      if (nameLower.includes(searchLower)) {
        nameMatchScore = 100;
      } else if (searchLower.includes(nameLower)) {
        nameMatchScore = 80;
      } else {
        const nameWords = nameLower.split(/\s+/);
        const searchWords = searchLower.split(/\s+/);
        const matchingWords = nameWords.filter(word => 
          searchWords.some(sw => word.includes(sw) || sw.includes(word))
        );
        nameMatchScore = (matchingWords.length / nameWords.length) * 60;
      }

      // Overall score
      const totalScore = (recencyScore * 0.5) + (frequencyScore * 0.3) + (nameMatchScore * 0.2);

      // Confidence
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
    .sort((a, b) => b.score - a.score);
}

export function formatTimeAgo(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) return 'today';
  if (daysDiff === 1) return 'yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks ago`;
  if (daysDiff < 365) return `${Math.floor(daysDiff / 30)} months ago`;
  return `${Math.floor(daysDiff / 365)} years ago`;
}