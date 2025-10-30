/**
 * Google Maps MCP Tools
 * Provides place search, directions, and location services
 */

// export const googleMapsTools = [
//   {
//     name: 'search_places',
//     description: 'Search for places like restaurants, coffee shops, ATMs, hotels, etc. Returns places with ratings, distance, and contact info.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         query: {
//           type: 'string',
//           description: 'What to search for (e.g., "coffee shop", "italian restaurant", "ATM")'
//         },
//         location: {
//           type: 'object',
//           description: 'Search location coordinates (user location or specific place)',
//           properties: {
//             lat: { type: 'number', description: 'Latitude' },
//             lng: { type: 'number', description: 'Longitude' }
//           },
//           required: ['lat', 'lng']
//         },
//         radius: {
//           type: 'number',
//           description: 'Search radius in meters (default: 5000, max: 50000)',
//           default: 5000
//         },
//         type: {
//           type: 'string',
//           description: 'Place type filter (e.g., "restaurant", "cafe", "hospital", "atm")',
//           enum: [
//             'restaurant', 'cafe', 'bar', 'bakery', 
//             'atm', 'bank', 'hospital', 'pharmacy',
//             'gas_station', 'parking', 'store', 'supermarket',
//             'hotel', 'lodging', 'tourist_attraction', 'museum',
//             'airport', 'bus_station', 'train_station'
//           ]
//         },
//         min_rating: {
//           type: 'number',
//           description: 'Minimum rating filter (1.0 to 5.0)',
//           minimum: 1.0,
//           maximum: 5.0
//         },
//         open_now: {
//           type: 'boolean',
//           description: 'Filter to only show places that are currently open'
//         },
//         limit: {
//           type: 'number',
//           description: 'Maximum number of results to return (default: 10, max: 20)',
//           default: 10,
//           maximum: 20
//         }
//       },
//       required: ['query', 'location']
//     }
//   },

//   {
//     name: 'get_directions',
//     description: 'Get directions from origin to destination with turn-by-turn instructions, distance, duration, and traffic info. Supports driving, walking, bicycling, and transit modes.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         origin: {
//           type: 'object',
//           description: 'Starting location',
//           properties: {
//             lat: { type: 'number', description: 'Latitude' },
//             lng: { type: 'number', description: 'Longitude' }
//           },
//           required: ['lat', 'lng']
//         },
//         destination: {
//           description: 'Destination (can be coordinates or place name)',
//           oneOf: [
//             {
//               type: 'object',
//               properties: {
//                 lat: { type: 'number' },
//                 lng: { type: 'number' }
//               },
//               required: ['lat', 'lng']
//             },
//             {
//               type: 'string',
//               description: 'Place name or address'
//             }
//           ]
//         },
//         mode: {
//           type: 'string',
//           description: 'Travel mode',
//           enum: ['driving', 'walking', 'bicycling', 'transit'],
//           default: 'driving'
//         },
//         alternatives: {
//           type: 'boolean',
//           description: 'Return alternative routes',
//           default: true
//         },
//         avoid: {
//           type: 'array',
//           description: 'Features to avoid in route',
//           items: {
//             type: 'string',
//             enum: ['tolls', 'highways', 'ferries']
//           }
//         },
//         departure_time: {
//           type: 'string',
//           description: 'Departure time in ISO format for traffic prediction'
//         },
//         arrival_time: {
//           type: 'string',
//           description: 'Desired arrival time in ISO format (transit only)'
//         }
//       },
//       required: ['origin', 'destination']
//     }
//   },

//   {
//     name: 'get_place_details',
//     description: 'Get detailed information about a specific place including hours, phone, website, reviews, photos, and ratings.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         place_id: {
//           type: 'string',
//           description: 'Google Place ID (from search_places results)'
//         },
//         place_name: {
//           type: 'string',
//           description: 'Place name (alternative to place_id)'
//         },
//         location: {
//           type: 'object',
//           description: 'Location for place name disambiguation',
//           properties: {
//             lat: { type: 'number' },
//             lng: { type: 'number' }
//           }
//         },
//         fields: {
//           type: 'array',
//           description: 'Specific fields to retrieve',
//           items: {
//             type: 'string',
//             enum: [
//               'name', 'address', 'phone', 'website', 'rating', 
//               'reviews', 'photos', 'opening_hours', 'price_level'
//             ]
//           }
//         }
//       }
//     }
//   },

//   {
//     name: 'calculate_distance',
//     description: 'Calculate distance and travel time between two locations. Quick calculation without full route details.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         origin: {
//           type: 'object',
//           description: 'Starting location',
//           properties: {
//             lat: { type: 'number' },
//             lng: { type: 'number' }
//           },
//           required: ['lat', 'lng']
//         },
//         destination: {
//           type: 'object',
//           description: 'Destination location',
//           properties: {
//             lat: { type: 'number' },
//             lng: { type: 'number' }
//           },
//           required: ['lat', 'lng']
//         },
//         mode: {
//           type: 'string',
//           description: 'Travel mode',
//           enum: ['driving', 'walking', 'bicycling', 'transit'],
//           default: 'driving'
//         }
//       },
//       required: ['origin', 'destination']
//     }
//   },

//   {
//     name: 'nearby_search',
//     description: 'Discover popular and highly-rated places near a location. Great for "what\'s around me" queries.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         location: {
//           type: 'object',
//           description: 'Center point for search',
//           properties: {
//             lat: { type: 'number' },
//             lng: { type: 'number' }
//           },
//           required: ['lat', 'lng']
//         },
//         radius: {
//           type: 'number',
//           description: 'Search radius in meters (default: 2000)',
//           default: 2000
//         },
//         type: {
//           type: 'string',
//           description: 'Type of places to find',
//           enum: [
//             'restaurant', 'cafe', 'bar', 'tourist_attraction',
//             'museum', 'park', 'shopping_mall', 'store'
//           ]
//         },
//         min_rating: {
//           type: 'number',
//           description: 'Minimum rating (default: 4.0)',
//           default: 4.0
//         },
//         keyword: {
//           type: 'string',
//           description: 'Keyword to refine search (e.g., "italian", "beach", "rooftop")'
//         },
//         limit: {
//           type: 'number',
//           description: 'Number of results (default: 10)',
//           default: 10
//         }
//       },
//       required: ['location']
//     }
//   }
// ];

// /**
//  * Tool response formats
//  */

// export const responseFormats = {
//   search_places: {
//     success: 'boolean',
//     query: 'string',
//     location: { lat: 'number', lng: 'number' },
//     results: [
//       {
//         name: 'string',
//         place_id: 'string',
//         address: 'string',
//         distance: 'string',
//         distance_meters: 'number',
//         rating: 'number',
//         ratings_count: 'number',
//         price_level: 'number',
//         open_now: 'boolean',
//         phone: 'string',
//         website: 'string',
//         types: ['string'],
//         location: { lat: 'number', lng: 'number' }
//       }
//     ],
//     total_results: 'number'
//   },

//   get_directions: {
//     success: 'boolean',
//     origin: 'string',
//     destination: 'string',
//     mode: 'string',
//     routes: [
//       {
//         summary: 'string',
//         distance: 'string',
//         duration: 'string',
//         duration_in_traffic: 'string',
//         steps: [
//           {
//             instruction: 'string',
//             distance: 'string',
//             duration: 'string',
//             start_location: { lat: 'number', lng: 'number' },
//             end_location: { lat: 'number', lng: 'number' }
//           }
//         ],
//         traffic_info: 'string',
//         warnings: ['string']
//       }
//     ]
//   },

//   get_place_details: {
//     success: 'boolean',
//     name: 'string',
//     place_id: 'string',
//     formatted_address: 'string',
//     phone: 'string',
//     website: 'string',
//     rating: 'number',
//     ratings_count: 'number',
//     price_level: 'number',
//     opening_hours: {
//       open_now: 'boolean',
//       weekday_text: ['string'],
//       periods: [
//         {
//           open: { day: 'number', time: 'string' },
//           close: { day: 'number', time: 'string' }
//         }
//       ]
//     },
//     reviews: [
//       {
//         author: 'string',
//         rating: 'number',
//         text: 'string',
//         time: 'string',
//         relative_time: 'string'
//       }
//     ],
//     photos: [
//       {
//         url: 'string',
//         width: 'number',
//         height: 'number',
//         attribution: 'string'
//       }
//     ],
//     types: ['string'],
//     location: { lat: 'number', lng: 'number' }
//   }
// };


/**
 * Google Maps MCP Tools
 * Provides place search, directions, and location services
 */

export const googleMapsTools = [
  {
    name: 'search_places',
    description: 'Search for places like restaurants, coffee shops, ATMs, hotels, hospitals, fitness centers. Returns places with ratings, distance, and contact info. Use specific queries: "fitness center gym" for gyms, "coffee shop cafe" for cafes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for. Be SPECIFIC: use "fitness center gym" not just "gym", "coffee shop cafe" not just "coffee". Examples: "italian restaurant", "24-hour pharmacy", "fitness center", "coffee shop"'
        },
        location: {
          type: 'object',
          description: 'Search location coordinates (user location or specific place)',
          properties: {
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' }
          },
          required: ['lat', 'lng']
        },
        radius: {
          type: 'number',
          description: 'Search radius in meters (default: 5000, max: 50000)',
          default: 5000
        },
        type: {
          type: 'string',
          description: 'Place type filter (e.g., "restaurant", "cafe", "hospital", "atm")',
          enum: [
            'restaurant', 'cafe', 'bar', 'bakery', 
            'atm', 'bank', 'hospital', 'pharmacy',
            'gas_station', 'parking', 'store', 'supermarket',
            'hotel', 'lodging', 'tourist_attraction', 'museum',
            'airport', 'bus_station', 'train_station', 'gym'
          ]
        },
        min_rating: {
          type: 'number',
          description: 'Minimum rating filter (1.0 to 5.0)',
          minimum: 1.0,
          maximum: 5.0
        },
        open_now: {
          type: 'boolean',
          description: 'Filter to only show places that are currently open'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 20)',
          default: 10,
          maximum: 20
        }
      },
      required: ['query', 'location']
    }
  },

  {
    name: 'get_directions',
    description: 'Get directions from origin to destination with turn-by-turn instructions, distance, duration, and traffic info. Supports driving, walking, bicycling, and transit modes.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'object',
          description: 'Starting location',
          properties: {
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' }
          },
          required: ['lat', 'lng']
        },
        destination: {
          description: 'Destination (can be coordinates or place name)',
          oneOf: [
            {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' }
              },
              required: ['lat', 'lng']
            },
            {
              type: 'string',
              description: 'Place name or address'
            }
          ]
        },
        mode: {
          type: 'string',
          description: 'Travel mode',
          enum: ['driving', 'walking', 'bicycling', 'transit'],
          default: 'driving'
        },
        alternatives: {
          type: 'boolean',
          description: 'Return alternative routes',
          default: true
        },
        avoid: {
          type: 'array',
          description: 'Features to avoid in route',
          items: {
            type: 'string',
            enum: ['tolls', 'highways', 'ferries']
          }
        },
        departure_time: {
          type: 'string',
          description: 'Departure time in ISO format for traffic prediction'
        },
        arrival_time: {
          type: 'string',
          description: 'Desired arrival time in ISO format (transit only)'
        }
      },
      required: ['origin', 'destination']
    }
  },

  {
    name: 'get_place_details',
    description: 'Get detailed information about a specific place including hours, phone, website, reviews, photos, and ratings.',
    inputSchema: {
      type: 'object',
      properties: {
        place_id: {
          type: 'string',
          description: 'Google Place ID (from search_places results)'
        },
        place_name: {
          type: 'string',
          description: 'Place name (alternative to place_id)'
        },
        location: {
          type: 'object',
          description: 'Location for place name disambiguation',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          }
        },
        fields: {
          type: 'array',
          description: 'Specific fields to retrieve',
          items: {
            type: 'string',
            enum: [
              'name', 'address', 'phone', 'website', 'rating', 
              'reviews', 'photos', 'opening_hours', 'price_level'
            ]
          }
        }
      }
    }
  },

  {
    name: 'calculate_distance',
    description: 'Calculate distance and travel time between two locations. Quick calculation without full route details.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'object',
          description: 'Starting location',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        },
        destination: {
          type: 'object',
          description: 'Destination location',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        },
        mode: {
          type: 'string',
          description: 'Travel mode',
          enum: ['driving', 'walking', 'bicycling', 'transit'],
          default: 'driving'
        }
      },
      required: ['origin', 'destination']
    }
  },

  {
    name: 'nearby_search',
    description: 'Discover popular and highly-rated places near a location. Great for "what\'s around me" queries.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'object',
          description: 'Center point for search',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        },
        radius: {
          type: 'number',
          description: 'Search radius in meters (default: 2000)',
          default: 2000
        },
        type: {
          type: 'string',
          description: 'Type of places to find',
          enum: [
            'restaurant', 'cafe', 'bar', 'tourist_attraction',
            'museum', 'park', 'shopping_mall', 'store'
          ]
        },
        min_rating: {
          type: 'number',
          description: 'Minimum rating (default: 4.0)',
          default: 4.0
        },
        keyword: {
          type: 'string',
          description: 'Keyword to refine search (e.g., "italian", "beach", "rooftop")'
        },
        limit: {
          type: 'number',
          description: 'Number of results (default: 10)',
          default: 10
        }
      },
      required: ['location']
    }
  }
];

/**
 * Tool response formats
 */

export const responseFormats = {
  search_places: {
    success: 'boolean',
    query: 'string',
    location: { lat: 'number', lng: 'number' },
    results: [
      {
        name: 'string',
        place_id: 'string',
        address: 'string',
        distance: 'string',
        distance_meters: 'number',
        rating: 'number',
        ratings_count: 'number',
        price_level: 'number',
        open_now: 'boolean',
        phone: 'string',
        website: 'string',
        types: ['string'],
        location: { lat: 'number', lng: 'number' }
      }
    ],
    total_results: 'number'
  },

  get_directions: {
    success: 'boolean',
    origin: 'string',
    destination: 'string',
    mode: 'string',
    routes: [
      {
        summary: 'string',
        distance: 'string',
        duration: 'string',
        duration_in_traffic: 'string',
        steps: [
          {
            instruction: 'string',
            distance: 'string',
            duration: 'string',
            start_location: { lat: 'number', lng: 'number' },
            end_location: { lat: 'number', lng: 'number' }
          }
        ],
        traffic_info: 'string',
        warnings: ['string']
      }
    ]
  },

  get_place_details: {
    success: 'boolean',
    name: 'string',
    place_id: 'string',
    formatted_address: 'string',
    phone: 'string',
    website: 'string',
    rating: 'number',
    ratings_count: 'number',
    price_level: 'number',
    opening_hours: {
      open_now: 'boolean',
      weekday_text: ['string'],
      periods: [
        {
          open: { day: 'number', time: 'string' },
          close: { day: 'number', time: 'string' }
        }
      ]
    },
    reviews: [
      {
        author: 'string',
        rating: 'number',
        text: 'string',
        time: 'string',
        relative_time: 'string'
      }
    ],
    photos: [
      {
        url: 'string',
        width: 'number',
        height: 'number',
        attribution: 'string'
      }
    ],
    types: ['string'],
    location: { lat: 'number', lng: 'number' }
  }
};