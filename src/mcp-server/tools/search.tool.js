import fetch from 'node-fetch';

/**
 * Search the internet using a search API
 * You'll need to set up a search API key (Google Custom Search, Bing, or SerpAPI)
 */
export async function searchInternetTool({ query, numResults = 5 }) {
  try {
    // Option 1: Using Google Custom Search API
    // You'll need to set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID env variables
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      // Option 2: Using DuckDuckGo (free, no API key required)
      return await searchWithDuckDuckGo(query, numResults);
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${numResults}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return {
        success: true,
        results: [],
        query: query,
        message: 'No search results found'
      };
    }

    const results = data.items.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink
    }));

    return {
      success: true,
      results: results,
      query: query,
      count: results.length,
      searchInformation: {
        totalResults: data.searchInformation?.totalResults,
        searchTime: data.searchInformation?.searchTime
      }
    };

  } catch (error) {
    console.error('Error searching internet:', error);
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

/**
 * Fallback search using DuckDuckGo (no API key required)
 */
async function searchWithDuckDuckGo(query, numResults = 5) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();

    // DuckDuckGo returns instant answers and related topics
    const results = [];

    // Add abstract if available
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Instant Answer',
        snippet: data.Abstract,
        link: data.AbstractURL,
        displayLink: data.AbstractSource
      });
    }

    // Add related topics
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, numResults - results.length).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0],
            snippet: topic.Text,
            link: topic.FirstURL,
            displayLink: new URL(topic.FirstURL).hostname
          });
        }
      });
    }

    return {
      success: true,
      results: results,
      query: query,
      count: results.length,
      provider: 'DuckDuckGo',
      message: results.length === 0 ? 'No results found' : undefined
    };

  } catch (error) {
    console.error('Error with DuckDuckGo search:', error);
    return {
      success: false,
      error: error.message,
      query: query,
      provider: 'DuckDuckGo'
    };
  }
}

/**
 * Fetch and extract content from a URL
 */
export async function fetchWebContentTool({ url, extractText = true }) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('text/html')) {
      return {
        success: false,
        error: 'URL does not return HTML content',
        contentType: contentType
      };
    }

    const html = await response.text();

    if (!extractText) {
      return {
        success: true,
        url: url,
        html: html,
        contentType: contentType
      };
    }

    // Simple text extraction (remove HTML tags)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit to 5000 characters

    return {
      success: true,
      url: url,
      text: text,
      contentType: contentType,
      length: text.length
    };

  } catch (error) {
    console.error('Error fetching web content:', error);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}
