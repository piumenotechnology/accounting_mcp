// src/mcp-server/tools/search.tool.js - FREE VERSION
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * FREE Web Search Tool using DuckDuckGo HTML scraping
 * No API key required!
 */
export async function webSearchTool({ query, search_type = 'general', count = 5 }) {
  try {
    console.error(`🔍 Searching web for: "${query}" (type: ${search_type})`);
    
    let results = {};
    
    // Text search using DuckDuckGo HTML
    if (search_type === 'general' || search_type === 'text') {
      try {
        const textResults = await searchDuckDuckGo(query, count);
        results.text = {
          query: query,
          results: textResults,
          summary: textResults.length > 0 ? generateSummary(textResults) : null
        };
      } catch (error) {
        console.error('Text search error:', error.message);
        results.text = {
          query: query,
          results: [],
          error: error.message
        };
      }
    }
    
    // Image search using DuckDuckGo
    if (search_type === 'general' || search_type === 'images') {
      try {
        const imageResults = await searchDuckDuckGoImages(query, Math.min(count, 10));
        results.images = {
          query: query,
          results: imageResults
        };
      } catch (error) {
        console.error('Image search error:', error.message);
        results.images = {
          query: query,
          results: [],
          error: error.message
        };
      }
    }
    
    console.error(`✅ Search completed: ${results.text?.results?.length || 0} text, ${results.images?.results?.length || 0} images`);
    
    return {
      success: true,
      data: results,
      query: query,
      search_type: search_type
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
 * FREE News Search using DuckDuckGo news
 */
export async function newsSearchTool({ query, count = 5, freshness = 'pw' }) {
  try {
    console.error(`📰 Searching news for: "${query}"`);
    
    // Add time-based query modifier
    let timeQuery = query;
    if (freshness === 'pd') {
      timeQuery = `${query} past 24 hours`;
    } else if (freshness === 'pw') {
      timeQuery = `${query} past week`;
    } else if (freshness === 'pm') {
      timeQuery = `${query} past month`;
    }
    
    const newsResults = await searchDuckDuckGoNews(timeQuery, count);
    
    console.error(`✅ Found ${newsResults.length} news articles`);
    
    return {
      success: true,
      data: {
        query: query,
        articles: newsResults,
        freshness: freshness
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
 * FREE Video Search using YouTube Data API (free tier: 10,000 requests/day)
 * Alternative: Scrape search results if no API key
 */
export async function videoSearchTool({ query, count = 5 }) {
  try {
    console.error(`🎥 Searching videos for: "${query}"`);
    
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    let videoResults;
    
    if (YOUTUBE_API_KEY) {
      // Use official API if available
      videoResults = await searchYouTubeAPI(query, count, YOUTUBE_API_KEY);
    } else {
      // Fallback: Use Invidious API (free, no key required)
      videoResults = await searchInvidiousAPI(query, count);
    }
    
    console.error(`✅ Found ${videoResults.length} videos`);
    
    return {
      success: true,
      data: {
        query: query,
        videos: videoResults
      }
    };
    
  } catch (error) {
    console.error('❌ Video search error:', error.message);
    
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

// ============================================================================
// Helper Functions - DuckDuckGo HTML Scraping (FREE)
// ============================================================================

async function searchDuckDuckGo(query, count = 5) {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: {
        q: query
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.result').each((i, element) => {
      if (results.length >= count) return false;
      
      const $result = $(element);
      const title = $result.find('.result__title').text().trim();
      const snippet = $result.find('.result__snippet').text().trim();
      const url = $result.find('.result__url').attr('href');
      
      if (title && url) {
        results.push({
          title: title,
          url: url.startsWith('//') ? 'https:' + url : url,
          description: snippet || 'No description available',
          published_date: 'Recent'
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('DuckDuckGo search error:', error.message);
    return [];
  }
}

async function searchDuckDuckGoImages(query, count = 10) {
  try {
    // Use DuckDuckGo's image API endpoint
    const vqd = await getDuckDuckGoVQD(query);
    
    if (!vqd) {
      return [];
    }
    
    const response = await axios.get('https://duckduckgo.com/i.js', {
      params: {
        q: query,
        o: 'json',
        p: '1',
        s: '0',
        u: 'bing',
        f: ',,,',
        l: 'us-en',
        vqd: vqd
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const results = [];
    const images = response.data.results || [];
    
    for (let i = 0; i < Math.min(count, images.length); i++) {
      const img = images[i];
      results.push({
        title: img.title || 'Untitled',
        url: img.image,
        thumbnail: img.thumbnail,
        source: img.source || 'Unknown',
        width: img.width,
        height: img.height
      });
    }
    
    return results;
  } catch (error) {
    console.error('DuckDuckGo image search error:', error.message);
    return [];
  }
}

async function getDuckDuckGoVQD(query) {
  try {
    const response = await axios.get('https://duckduckgo.com/', {
      params: { q: query },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const vqdMatch = response.data.match(/vqd=['"]([^'"]+)['"]/);
    return vqdMatch ? vqdMatch[1] : null;
  } catch (error) {
    console.error('Error getting VQD:', error.message);
    return null;
  }
}

async function searchDuckDuckGoNews(query, count = 5) {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: {
        q: query,
        iar: 'news'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.result').each((i, element) => {
      if (results.length >= count) return false;
      
      const $result = $(element);
      const title = $result.find('.result__title').text().trim();
      const snippet = $result.find('.result__snippet').text().trim();
      const url = $result.find('.result__url').attr('href');
      const date = $result.find('.result__timestamp').text().trim();
      
      if (title && url) {
        results.push({
          title: title,
          url: url.startsWith('//') ? 'https:' + url : url,
          description: snippet || 'No description available',
          published_date: date || 'Recent',
          source: extractDomain(url),
          thumbnail: null
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('DuckDuckGo news search error:', error.message);
    return [];
  }
}

// ============================================================================
// Helper Functions - YouTube (FREE - using Invidious)
// ============================================================================

// async function searchInvidiousAPI(query, count = 5) {
//   try {
//     // Use public Invidious instances (free YouTube API alternative)
//     const instances = [
//       'https://invidious.snopyta.org',
//       'https://yewtu.be',
//       'https://invidious.kavin.rocks'
//     ];
    
//     for (const instance of instances) {
//       try {
//         const response = await axios.get(`${instance}/api/v1/search`, {
//           params: {
//             q: query,
//             type: 'video',
//             sort_by: 'relevance'
//           },
//           timeout: 10000
//         });
        
//         const results = [];
//         const videos = response.data.slice(0, count);
        
//         for (const video of videos) {
//           results.push({
//             title: video.title,
//             url: `https://www.youtube.com/watch?v=${video.videoId}`,
//             description: video.description || 'No description available',
//             thumbnail: video.videoThumbnails?.[0]?.url || null,
//             duration: formatDuration(video.lengthSeconds),
//             views: formatViews(video.viewCount),
//             channel: video.author,
//             published_date: formatPublishedDate(video.publishedText)
//           });
//         }
        
//         return results;
//       } catch (error) {
//         console.error(`Failed with ${instance}, trying next...`);
//         continue;
//       }
//     }
    
//     return [];
//   } catch (error) {
//     console.error('Invidious API error:', error.message);
//     return [];
//   }
// }

// async function searchYouTubeAPI(query, count, apiKey) {
//   try {
//     const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
//       params: {
//         part: 'snippet',
//         q: query,
//         type: 'video',
//         maxResults: count,
//         key: apiKey
//       },
//       timeout: 10000
//     });
    
//     const results = [];
    
//     for (const item of response.data.items) {
//       results.push({
//         title: item.snippet.title,
//         url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
//         description: item.snippet.description,
//         thumbnail: item.snippet.thumbnails.medium.url,
//         duration: 'Unknown',
//         views: 'Unknown',
//         channel: item.snippet.channelTitle,
//         published_date: formatPublishedDate(item.snippet.publishedAt)
//       });
//     }
    
//     return results;
//   } catch (error) {
//     console.error('YouTube API error:', error.message);
//     return [];
//   }
// }

// ============================================================================
// Utility Functions
// ============================================================================

function generateSummary(results) {
  if (results.length === 0) return null;
  
  // Simple summary from first result's description
  const firstDescription = results[0].description;
  return firstDescription.length > 200 
    ? firstDescription.substring(0, 200) + '...'
    : firstDescription;
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url.startsWith('//') ? 'https:' + url : url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(count) {
  if (!count) return 'Unknown';
  
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
}

function formatPublishedDate(dateString) {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return dateString;
  }
}