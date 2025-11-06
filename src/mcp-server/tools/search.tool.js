// src/mcp-server/tools/search.tool.js - TAVILY API VERSION
import axios from 'axios';

/**
 * Web Search Tool using Tavily API
 * Features: Web search, AI-powered summaries, image search
 * Free tier: 1,000 searches/month
 */
export async function webSearchTool({ query, include_images = true, max_results = 5 }) {
  try {
    console.error(`🔍 Searching web for: "${query}"`);
    
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
    if (!TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY not configured');
    }
    
    // Call Tavily Search API
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: 'basic', // 'basic' or 'advanced'
      include_images: include_images,
      include_answer: true, // Get AI-generated summary
      max_results: max_results
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const data = response.data;
    
    // Format results
    const results = {
      query: query,
      answer: data.answer || null, // AI-generated summary
      results: data.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content, // Snippet/excerpt
        score: result.score, // Relevance score
        published_date: result.published_date || null
      })),
      images: data.images || [],
      response_time: data.response_time
    };
    
    console.error(`✅ Search completed: ${results.results.length} results, ${results.images.length} images`);
    if (results.answer) {
      console.error(`📝 AI summary generated`);
    }
    
    return {
      success: true,
      data: results
    };
    
  } catch (error) {
    console.error('❌ Web search error:', error.message);
    
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

/**
 * News Search Tool using Tavily
 * Searches for recent news articles
 */
export async function newsSearchTool({ query, days = 7, max_results = 5 }) {
  try {
    console.error(`📰 Searching news for: "${query}"`);
    
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
    if (!TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY not configured');
    }
    
    // Calculate date range
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - days);
    
    // Call Tavily with news-focused parameters
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: 'basic',
      topic: 'news', // Focus on news sources
      include_answer: true,
      max_results: max_results,
      include_domains: [], // Can specify news domains
      exclude_domains: []
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const data = response.data;
    
    // Filter and format news results
    const newsResults = data.results
      .filter(result => {
        // Filter by date if published_date is available
        if (result.published_date) {
          const publishedDate = new Date(result.published_date);
          return publishedDate >= pastDate;
        }
        return true; // Include if no date available
      })
      .map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        published_date: result.published_date || 'Recent',
        source: extractDomain(result.url),
        score: result.score
      }));
    
    console.error(`✅ Found ${newsResults.length} news articles`);
    
    return {
      success: true,
      data: {
        query: query,
        answer: data.answer || null,
        articles: newsResults,
        days: days
      }
    };
    
  } catch (error) {
    console.error('❌ News search error:', error.message);
    
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

/**
 * Deep Search Tool using Tavily Advanced
 * For research and comprehensive information gathering
 */
export async function deepSearchTool({ query, max_results = 10 }) {
  try {
    console.error(`🔬 Deep search for: "${query}"`);
    
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
    if (!TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY not configured');
    }
    
    // Call Tavily with advanced search depth
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: 'advanced', // More comprehensive search
      include_images: true,
      include_answer: true,
      include_raw_content: false,
      max_results: max_results
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Longer timeout for advanced search
    });
    
    const data = response.data;
    
    const results = {
      query: query,
      answer: data.answer || null,
      results: data.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        published_date: result.published_date || null
      })),
      images: data.images || [],
      response_time: data.response_time
    };
    
    console.error(`✅ Deep search completed: ${results.results.length} results`);
    
    return {
      success: true,
      data: results
    };
    
  } catch (error) {
    console.error('❌ Deep search error:', error.message);
    
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}


// // src/mcp-server/tools/search.tool.js
// import axios from 'axios';

// /**
//  * Tavily Search Wrapper
//  * Key improvements:
//  * 1) Strong input validation and sane defaults
//  * 2) Centralized client with retries, timeouts, and error shaping
//  * 3) Consistent result schema: { query, answer, results[], images[], meta{} }
//  * 4) News mode with real date filtering, recency scoring, dedupe, sorting
//  * 5) Optional domain filters, language, region, depth control
//  * 6) Graceful partial failures, never throws raw axios errors
//  */

// const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// function assertEnv() {
//   if (!TAVILY_API_KEY) {
//     throw new Error('TAVILY_API_KEY not configured');
//   }
// }

// // naive ISO parsing that will not crash on weird strings
// function toDateSafe(v) {
//   try {
//     const d = new Date(v);
//     return Number.isNaN(d.getTime()) ? null : d;
//   } catch {
//     return null;
//   }
// }

// // clamp utility
// function clamp(n, min, max) {
//   return Math.max(min, Math.min(max, n));
// }

// // simple URL canonicalization and host extraction
// function safeUrl(u) {
//   try { return new URL(u).toString(); } catch { return null; }
// }
// function hostOf(u) {
//   try {
//     const h = new URL(u).hostname.replace(/^www\./, '');
//     return h || 'unknown';
//   } catch { return 'unknown'; }
// }

// // dedupe by canonical URL, falling back to title+host
// function dedupe(items) {
//   const seen = new Set();
//   const out = [];
//   for (const it of items) {
//     const key = it.url || `${it.title}|${it.source}`;
//     if (seen.has(key)) continue;
//     seen.add(key);
//     out.push(it);
//   }
//   return out;
// }

// // recency score, recent wins, older gets a penalty
// function recencyBoost(dt, now = new Date()) {
//   if (!dt) return 0;
//   const days = (now - dt) / 86400000;
//   if (days < 0) return 0; // future dates, ignore boost
//   // 0 to 1 boost, strong in first 7 days, taper after
//   if (days <= 1) return 1.0;
//   if (days <= 7) return 0.85 - (days - 1) * 0.07; // linear drop to ~0.43 at day 7
//   if (days <= 30) return 0.35 - (days - 7) * 0.01; // taper
//   return 0.0;
// }

// // unified axios client
// const http = axios.create({
//   baseURL: 'https://api.tavily.com',
//   headers: { 'Content-Type': 'application/json' },
//   timeout: 15000
// });

// // tiny retry wrapper, 2 quick retries on network-ish errors
// async function postWithRetry(path, payload, tries = 3) {
//   let lastErr = null;
//   for (let i = 0; i < tries; i++) {
//     try {
//       return await http.post(path, payload);
//     } catch (err) {
//       lastErr = err;
//       const code = err?.code || err?.response?.status;
//       const transient = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 429 || code >= 500;
//       if (!transient) break;
//       // small backoff, cap at 900 ms
//       await new Promise(r => setTimeout(r, Math.min(300 * (i + 1), 900)));
//     }
//   }
//   throw lastErr;
// }

// // map Tavily response into a consistent item schema
// function normalizeResult(r) {
//   const url = safeUrl(r.url);
//   const publishedAt = toDateSafe(r.published_date || null);
//   return {
//     title: r.title || '',
//     url,
//     snippet: r.content || '',
//     source: hostOf(url || ''),
//     score: typeof r.score === 'number' ? r.score : null,
//     published_at: publishedAt ? publishedAt.toISOString() : null
//   };
// }

// function shapeSuccess({ query, data, mode, extraMeta = {} }) {
//   const items = Array.isArray(data?.results) ? data.results.map(normalizeResult) : [];
//   const images = Array.isArray(data?.images) ? data.images : [];
//   return {
//     success: true,
//     data: {
//       query,
//       mode, // 'web', 'news', 'deep'
//       answer: data?.answer || null,
//       results: items,
//       images,
//       meta: {
//         response_time_ms: data?.response_time ?? null,
//         total_results: items.length,
//         ...extraMeta
//       }
//     }
//   };
// }

// function shapeError(query, error) {
//   const msg = error?.response?.data?.message || error?.message || 'Unknown error';
//   const status = error?.response?.status || null;
//   return { success: false, error: msg, status, query };
// }

// /**
//  * Core call to Tavily
//  */
// async function tavilySearch({
//   query,
//   depth = 'basic', // 'basic' or 'advanced'
//   include_images = false,
//   include_answer = true,
//   max_results = 5,
//   topic, // 'news' for news focus
//   include_domains,
//   exclude_domains,
//   language, // e.g., 'en', 'fr'
//   country // e.g., 'us', 'ca'
// }) {
//   assertEnv();
//   const q = String(query || '').trim();
//   if (!q) return { success: false, error: 'Empty query', query: '' };
//   const mr = clamp(Number(max_results) || 5, 1, 20);

//   const payload = {
//     api_key: TAVILY_API_KEY,
//     query: q,
//     search_depth: depth === 'advanced' ? 'advanced' : 'basic',
//     include_images: !!include_images,
//     include_answer: !!include_answer,
//     max_results: mr
//   };

//   if (topic) payload.topic = topic;
//   if (Array.isArray(include_domains) && include_domains.length) payload.include_domains = include_domains;
//   if (Array.isArray(exclude_domains) && exclude_domains.length) payload.exclude_domains = exclude_domains;
//   if (language) payload.language = language;
//   if (country) payload.country = country;

//   try {
//     const res = await postWithRetry('/search', payload);
//     return shapeSuccess({ query: q, data: res.data, mode: topic === 'news' ? 'news' : depth === 'advanced' ? 'deep' : 'web' });
//   } catch (err) {
//     return shapeError(q, err);
//   }
// }

// /**
//  * Public tool, general web search
//  */
// export async function webSearchTool({
//   query,
//   include_images = false,
//   max_results = 5,
//   include_domains,
//   exclude_domains,
//   language,
//   country
// }) {
//   const out = await tavilySearch({
//     query,
//     include_images,
//     include_answer: true,
//     max_results,
//     include_domains,
//     exclude_domains,
//     language,
//     country,
//     depth: 'basic'
//   });
//   // nothing more to do here, caller gets consistent shape
//   return out;
// }

// /**
//  * Public tool, deep search for research
//  */
// export async function deepSearchTool({
//   query,
//   max_results = 10,
//   include_images = true,
//   include_domains,
//   exclude_domains,
//   language,
//   country
// }) {
//   return await tavilySearch({
//     query,
//     depth: 'advanced',
//     include_images,
//     include_answer: true,
//     max_results,
//     include_domains,
//     exclude_domains,
//     language,
//     country
//   });
// }

// /**
//  * Public tool, news search with real recency filtering and sorting
//  * days, how far back to look, default 7
//  */
// export async function newsSearchTool({
//   query,
//   days = 7,
//   max_results = 8,
//   include_domains,
//   exclude_domains,
//   language,
//   country
// }) {
//   const windowDays = clamp(Number(days) || 7, 1, 60);
//   const now = new Date();
//   const since = new Date(now.getTime() - windowDays * 86400000);

//   const raw = await tavilySearch({
//     query,
//     topic: 'news',
//     include_answer: true,
//     max_results,
//     include_domains,
//     exclude_domains,
//     language,
//     country,
//     depth: 'basic'
//   });
//   if (!raw.success) return raw;

//   // post filter, sort, and dedupe
//   const results = (raw.data?.results || [])
//     .map(it => {
//       const dt = it.published_at ? toDateSafe(it.published_at) : null;
//       return { ...it, _dateObj: dt };
//     })
//     .filter(it => {
//       if (!it._dateObj) return true; // keep undated, you can change this to false if you want strict filtering
//       return it._dateObj >= since && it._dateObj <= now;
//     });

//   // score by a mix of Tavily relevance and recency
//   for (const it of results) {
//     const base = typeof it.score === 'number' ? it.score : 0.5;
//     const boost = recencyBoost(it._dateObj, now); // 0 to 1
//     it._rank = base * 0.7 + boost * 0.3;
//   }

//   const sorted = results.sort((a, b) => (b._rank ?? 0) - (a._rank ?? 0));
//   const cleaned = dedupe(sorted).map(({ _dateObj, _rank, ...rest }) => rest);

//   return {
//     success: true,
//     data: {
//       query: raw.data.query,
//       mode: 'news',
//       answer: raw.data.answer || null,
//       results: cleaned,
//       images: raw.data.images || [],
//       meta: {
//         response_time_ms: raw.data.meta?.response_time_ms ?? null,
//         total_results: cleaned.length,
//         filtered_window_days: windowDays,
//         window_start: since.toISOString(),
//         window_end: now.toISOString()
//       }
//     }
//   };
// }
