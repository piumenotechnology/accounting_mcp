import GoogleMapsService from '../../services/google-maps.js';

const mapsService = new GoogleMapsService();

export async function handleSearchPlaces(args) {
  try {
    console.log('🔧 Tool called: search_places');
    
    // Extract location from user_location if provided
    const location = args.location || args.user_location;
    
    if (!location || !location.lat || !location.lng) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'location with lat/lng is required'
            })
          }
        ]
      };
    }

    // Validate query
    if (!args.query) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'query parameter is required'
            })
          }
        ]
      };
    }

    // Call service
    const result = await mapsService.searchPlaces({
      query: args.query,
      location: location,
      radius: args.radius || 5000,
      type: args.type,
      min_rating: args.min_rating,
      open_now: args.open_now,
      limit: args.limit || 10
    });

    // ✅ Return in correct MCP format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('❌ handleSearchPlaces error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }
      ]
    };
  }
}

export async function handleGetDirections(args) {
  try {
    console.log('🔧 Tool called: get_directions');
    
    // Extract location from user_location if provided
    const origin = args.origin || args.user_location;
    
    if (!origin || !origin.lat || !origin.lng) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'origin with lat/lng is required'
            })
          }
        ]
      };
    }

    if (!args.destination) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'destination is required'
            })
          }
        ]
      };
    }

    // Call service
    const result = await mapsService.getDirections({
      origin: origin,
      destination: args.destination,
      mode: args.mode || 'driving',
      alternatives: args.alternatives !== false,
      avoid: args.avoid || [],
      departure_time: args.departure_time,
      arrival_time: args.arrival_time
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('❌ handleGetDirections error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }
      ]
    };
  }
}

export async function handleGetPlaceDetails(args) {
  try {
    console.log('🔧 Tool called: get_place_details');
    
    if (!args.place_id && !args.place_name) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Either place_id or place_name is required'
            })
          }
        ]
      };
    }

    // Call service
    const result = await mapsService.getPlaceDetails({
      place_id: args.place_id,
      place_name: args.place_name,
      location: args.location || args.user_location,
      fields: args.fields
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('❌ handleGetPlaceDetails error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }
      ]
    };
  }
}

export async function handleCalculateDistance(args) {
  try {
    console.log('🔧 Tool called: calculate_distance');
    
    const origin = args.origin || args.user_location;
    
    if (!origin || !origin.lat || !origin.lng) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'origin with lat/lng is required'
            })
          }
        ]
      };
    }

    if (!args.destination || !args.destination.lat || !args.destination.lng) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'destination with lat/lng is required'
            })
          }
        ]
      };
    }

    // Call service
    const result = await mapsService.calculateDistance(
      origin,
      args.destination,
      args.mode || 'driving'
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('❌ handleCalculateDistance error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }
      ]
    };
  }
}

export async function handleNearbySearch(args) {
  try {
    console.log('🔧 Tool called: nearby_search');
    
    const location = args.location || args.user_location;
    
    if (!location || !location.lat || !location.lng) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'location with lat/lng is required'
            })
          }
        ]
      };
    }

    // Call service
    const result = await mapsService.nearbySearch({
      location: location,
      radius: args.radius || 2000,
      type: args.type,
      min_rating: args.min_rating || 4.0,
      keyword: args.keyword,
      limit: args.limit || 10
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('❌ handleNearbySearch error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }
      ]
    };
  }
}

export const googleMapsHandlers = {
  'search_places': handleSearchPlaces,
  'get_directions': handleGetDirections,
  'get_place_details': handleGetPlaceDetails,
  'calculate_distance': handleCalculateDistance,
  'nearby_search': handleNearbySearch
};