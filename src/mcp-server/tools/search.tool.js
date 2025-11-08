// // src/mcp-server/tools/search.tool.js - TAVILY API VERSION
// import axios from 'axios';

// /**
//  * Web Search Tool using Tavily API
//  * Features: Web search, AI-powered summaries, image search
//  * Free tier: 1,000 searches/month
//  */
// export async function webSearchTool({ query, include_images = true, max_results = 5 }) {
//   try {
//     console.error(`🔍 Searching web for: "${query}"`);
    
//     const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
//     if (!TAVILY_API_KEY) {
//       throw new Error('TAVILY_API_KEY not configured');
//     }
    
//     // Call Tavily Search API
//     const response = await axios.post('https://api.tavily.com/search', {
//       api_key: TAVILY_API_KEY,
//       query: query,
//       search_depth: 'basic', // 'basic' or 'advanced'
//       include_images: include_images,
//       include_answer: true, // Get AI-generated summary
//       max_results: max_results
//     }, {
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       timeout: 15000
//     });
    
//     const data = response.data;
    
//     // Format results
//     const results = {
//       query: query,
//       answer: data.answer || null, // AI-generated summary
//       results: data.results.map(result => ({
//         title: result.title,
//         url: result.url,
//         content: result.content, // Snippet/excerpt
//         score: result.score, // Relevance score
//         published_date: result.published_date || null
//       })),
//       images: data.images || [],
//       response_time: data.response_time
//     };
    
//     console.error(`✅ Search completed: ${results.results.length} results, ${results.images.length} images`);
//     if (results.answer) {
//       console.error(`📝 AI summary generated`);
//     }
    
//     return {
//       success: true,
//       data: results
//     };
    
//   } catch (error) {
//     console.error('❌ Web search error:', error.message);
    
//     return {
//       success: false,
//       error: error.message,
//       query: query
//     };
//   }
// }

// /**
//  * News Search Tool using Tavily
//  * Searches for recent news articles WITH IMAGES
//  */
// export async function newsSearchTool({ query, days = 7, max_results = 5 }) {
//   try {
//     console.error(`📰 Searching news for: "${query}"`);
    
//     const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
//     if (!TAVILY_API_KEY) {
//       throw new Error('TAVILY_API_KEY not configured');
//     }
    
//     // Calculate date range
//     const today = new Date();
//     const pastDate = new Date(today);
//     pastDate.setDate(pastDate.getDate() - days);
    
//     // Call Tavily with news-focused parameters
//     const response = await axios.post('https://api.tavily.com/search', {
//       api_key: TAVILY_API_KEY,
//       query: query,
//       search_depth: 'basic',
//       topic: 'news', // Focus on news sources
//       include_answer: true,
//       include_images: true, // ✅ NOW INCLUDES IMAGES
//       max_results: max_results,
//       include_domains: [], // Can specify news domains
//       exclude_domains: []
//     }, {
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       timeout: 15000
//     });
    
//     const data = response.data;
    
//     // Filter and format news results
//     const newsResults = data.results
//       .filter(result => {
//         // Filter by date if published_date is available
//         if (result.published_date) {
//           const publishedDate = new Date(result.published_date);
//           return publishedDate >= pastDate;
//         }
//         return true; // Include if no date available
//       })
//       .map(result => ({
//         title: result.title,
//         url: result.url,
//         content: result.content,
//         published_date: result.published_date || 'Recent',
//         source: extractDomain(result.url),
//         score: result.score
//       }));
    
//     console.error(`✅ Found ${newsResults.length} news articles, ${data.images?.length || 0} images`);
    
//     return {
//       success: true,
//       data: {
//         query: query,
//         answer: data.answer || null,
//         articles: newsResults,
//         images: data.images || [], // ✅ Images now included in response
//         days: days
//       }
//     };
    
//   } catch (error) {
//     console.error('❌ News search error:', error.message);
    
//     return {
//       success: false,
//       error: error.message,
//       query: query
//     };
//   }
// }

// /**
//  * Deep Search Tool using Tavily Advanced
//  * For research and comprehensive information gathering
//  */
// export async function deepSearchTool({ query, max_results = 10 }) {
//   try {
//     console.error(`🔬 Deep search for: "${query}"`);
    
//     const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
//     if (!TAVILY_API_KEY) {
//       throw new Error('TAVILY_API_KEY not configured');
//     }
    
//     // Call Tavily with advanced search depth
//     const response = await axios.post('https://api.tavily.com/search', {
//       api_key: TAVILY_API_KEY,
//       query: query,
//       search_depth: 'advanced', // More comprehensive search
//       include_images: true,
//       include_answer: true,
//       include_raw_content: false,
//       max_results: max_results
//     }, {
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       timeout: 30000 // Longer timeout for advanced search
//     });
    
//     const data = response.data;
    
//     const results = {
//       query: query,
//       answer: data.answer || null,
//       results: data.results.map(result => ({
//         title: result.title,
//         url: result.url,
//         content: result.content,
//         score: result.score,
//         published_date: result.published_date || null
//       })),
//       images: data.images || [],
//       response_time: data.response_time
//     };
    
//     console.error(`✅ Deep search completed: ${results.results.length} results`);
    
//     return {
//       success: true,
//       data: results
//     };
    
//   } catch (error) {
//     console.error('❌ Deep search error:', error.message);
    
//     return {
//       success: false,
//       error: error.message,
//       query: query
//     };
//   }
// }

// // ============================================================================
// // Utility Functions
// // ============================================================================

// function extractDomain(url) {
//   try {
//     const urlObj = new URL(url);
//     return urlObj.hostname.replace('www.', '');
//   } catch {
//     return 'Unknown';
//   }
// }

// src/mcp-server/tools/search.tool.js - TAVILY API VERSION (IMPROVED)
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
      include_images: true, // ✅ ALWAYS TRUE - Force images
      include_answer: true, // Get AI-generated summary
      max_results: max_results
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const data = response.data;
    
    // Format results with guaranteed image array
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
      images: Array.isArray(data.images) ? data.images : [], // ✅ Ensure array
      response_time: data.response_time
    };
    
    console.error(`✅ Search completed: ${results.results.length} results, ${results.images.length} images`);
    if (results.answer) {
      console.error(`📝 AI summary generated`);
    }
    
    // ✅ Log warning if no images found
    if (results.images.length === 0) {
      console.error(`⚠️ Warning: No images found for query "${query}"`);
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
 * Searches for recent news articles WITH IMAGES (GUARANTEED)
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
      include_images: true, // ✅ FORCE IMAGES
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
    
    // ✅ ENSURE IMAGES ARE ALWAYS IN RESPONSE
    const images = Array.isArray(data.images) ? data.images : [];
    
    console.error(`✅ Found ${newsResults.length} news articles, ${images.length} images`);
    
    // ✅ Warning if no images
    if (images.length === 0) {
      console.error(`⚠️ Warning: No images found for news query "${query}"`);
    }
    
    return {
      success: true,
      data: {
        query: query,
        answer: data.answer || null,
        articles: newsResults,
        images: images, // ✅ Always present, even if empty array
        images_count: images.length, // ✅ Explicit count
        days: days,
        has_images: images.length > 0 // ✅ Boolean flag
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
 * For research and comprehensive information gathering WITH IMAGES
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
      include_images: true, // ✅ FORCE IMAGES
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
    
    // ✅ Ensure images array exists
    const images = Array.isArray(data.images) ? data.images : [];
    
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
      images: images, // ✅ Always array
      images_count: images.length, // ✅ Explicit count
      has_images: images.length > 0, // ✅ Boolean flag
      response_time: data.response_time
    };
    
    console.error(`✅ Deep search completed: ${results.results.length} results, ${images.length} images`);
    
    // ✅ Warning if no images
    if (images.length === 0) {
      console.error(`⚠️ Warning: No images found for deep search "${query}"`);
    }
    
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