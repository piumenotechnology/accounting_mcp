// import { Client } from '@googlemaps/google-maps-services-js';

// /**
//  * Google Maps Service
//  * Handles all Google Maps API interactions
//  */

// class GoogleMapsService {
//   constructor() {
//     this.client = new Client({});
//     this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
//     if (!this.apiKey) {
//       console.warn('⚠️ GOOGLE_MAPS_API_KEY not set');
//     }
//   }

//   /**
//    * Search for places
//    */
//   async searchPlaces({ query, location, radius = 5000, type, min_rating, open_now, limit = 10 }) {
//     try {
//       console.log(`🔍 Searching places: "${query}" near (${location.lat}, ${location.lng})`);

//       // Use Text Search API
//       const response = await this.client.textSearch({
//         params: {
//           query: query,
//           location: `${location.lat},${location.lng}`,
//           radius: radius,
//           type: type,
//           key: this.apiKey
//         }
//       });

//       if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
//         throw new Error(`Google Maps API error: ${response.data.status}`);
//       }

//       let results = response.data.results || [];

//       // Filter by rating
//       if (min_rating) {
//         results = results.filter(place => place.rating >= min_rating);
//       }

//       // Filter by open_now
//       if (open_now) {
//         results = results.filter(place => 
//           place.opening_hours && place.opening_hours.open_now === true
//         );
//       }

//       // Limit results
//       results = results.slice(0, limit);

//       // Calculate distances
//       const distancePromises = results.map(place => 
//         this.calculateDistance(location, place.geometry.location, 'driving')
//       );
      
//       const distances = await Promise.all(distancePromises);

//       // Format results
//       const formattedResults = results.map((place, index) => ({
//         name: place.name,
//         place_id: place.place_id,
//         address: place.formatted_address,
//         distance: distances[index].distance,
//         distance_meters: distances[index].distance_value,
//         rating: place.rating || null,
//         ratings_count: place.user_ratings_total || 0,
//         price_level: place.price_level || null,
//         open_now: place.opening_hours?.open_now || null,
//         phone: place.formatted_phone_number || null,
//         website: place.website || null,
//         types: place.types || [],
//         location: {
//           lat: place.geometry.location.lat,
//           lng: place.geometry.location.lng
//         }
//       }));

//       console.log(`✅ Found ${formattedResults.length} places`);

//       return {
//         success: true,
//         query: query,
//         location: location,
//         results: formattedResults,
//         total_results: formattedResults.length
//       };

//     } catch (error) {
//       console.error('❌ Search places error:', error.message);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Get directions between two points
//    */
//   async getDirections({ origin, destination, mode = 'driving', alternatives = true, avoid = [], departure_time, arrival_time }) {
//     try {
//       console.log(`🗺️ Getting directions: ${mode} mode`);

//       // Handle destination as string or coordinates
//       const destParam = typeof destination === 'string' 
//         ? destination 
//         : `${destination.lat},${destination.lng}`;

//       const params = {
//         origin: `${origin.lat},${origin.lng}`,
//         destination: destParam,
//         mode: mode,
//         alternatives: alternatives,
//         key: this.apiKey
//       };

//       // Add optional parameters
//       if (avoid.length > 0) {
//         params.avoid = avoid.join('|');
//       }

//       if (departure_time) {
//         params.departure_time = new Date(departure_time).getTime() / 1000;
//       }

//       if (arrival_time && mode === 'transit') {
//         params.arrival_time = new Date(arrival_time).getTime() / 1000;
//       }

//       const response = await this.client.directions({ params });

//       if (response.data.status !== 'OK') {
//         throw new Error(`Directions API error: ${response.data.status}`);
//       }

//       const routes = response.data.routes.map(route => {
//         const leg = route.legs[0]; // First leg for single-leg journey

//         return {
//           summary: route.summary,
//           distance: leg.distance.text,
//           distance_value: leg.distance.value,
//           duration: leg.duration.text,
//           duration_value: leg.duration.value,
//           duration_in_traffic: leg.duration_in_traffic 
//             ? leg.duration_in_traffic.text 
//             : leg.duration.text,
//           steps: leg.steps.map(step => ({
//             instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML
//             distance: step.distance.text,
//             duration: step.duration.text,
//             start_location: {
//               lat: step.start_location.lat,
//               lng: step.start_location.lng
//             },
//             end_location: {
//               lat: step.end_location.lat,
//               lng: step.end_location.lng
//             },
//             travel_mode: step.travel_mode
//           })),
//           traffic_info: leg.duration_in_traffic 
//             ? this.getTrafficLevel(leg.duration.value, leg.duration_in_traffic.value)
//             : null,
//           warnings: route.warnings || []
//         };
//       });

//       console.log(`✅ Found ${routes.length} route(s)`);

//       return {
//         success: true,
//         origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
//         destination: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
//         mode: mode,
//         routes: routes
//       };

//     } catch (error) {
//       console.error('❌ Get directions error:', error.message);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Get detailed place information
//    */
//   async getPlaceDetails({ place_id, place_name, location, fields }) {
//     try {
//       let placeId = place_id;

//       // If place_name provided, find place_id first
//       if (!placeId && place_name) {
//         const searchResult = await this.searchPlaces({
//           query: place_name,
//           location: location,
//           limit: 1
//         });

//         if (searchResult.success && searchResult.results.length > 0) {
//           placeId = searchResult.results[0].place_id;
//         } else {
//           throw new Error(`Place "${place_name}" not found`);
//         }
//       }

//       if (!placeId) {
//         throw new Error('Either place_id or place_name is required');
//       }

//       console.log(`📍 Getting details for place: ${placeId}`);

//       const response = await this.client.placeDetails({
//         params: {
//           place_id: placeId,
//           fields: fields || [
//             'name', 'formatted_address', 'formatted_phone_number',
//             'website', 'rating', 'user_ratings_total', 'price_level',
//             'opening_hours', 'reviews', 'photos', 'types', 'geometry'
//           ].join(','),
//           key: this.apiKey
//         }
//       });

//       if (response.data.status !== 'OK') {
//         throw new Error(`Place Details API error: ${response.data.status}`);
//       }

//       const place = response.data.result;

//       return {
//         success: true,
//         name: place.name,
//         place_id: placeId,
//         formatted_address: place.formatted_address,
//         phone: place.formatted_phone_number || null,
//         website: place.website || null,
//         rating: place.rating || null,
//         ratings_count: place.user_ratings_total || 0,
//         price_level: place.price_level || null,
//         opening_hours: place.opening_hours ? {
//           open_now: place.opening_hours.open_now,
//           weekday_text: place.opening_hours.weekday_text || [],
//           periods: place.opening_hours.periods || []
//         } : null,
//         reviews: place.reviews ? place.reviews.slice(0, 5).map(review => ({
//           author: review.author_name,
//           rating: review.rating,
//           text: review.text,
//           time: new Date(review.time * 1000).toISOString(),
//           relative_time: review.relative_time_description
//         })) : [],
//         photos: place.photos ? place.photos.slice(0, 5).map(photo => ({
//           url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1920&photoreference=${photo.photo_reference}&key=${this.apiKey}`,
//           width: photo.width,
//           height: photo.height,
//           attribution: photo.html_attributions?.[0] || ''
//         })) : [],
//         types: place.types || [],
//         location: place.geometry ? {
//           lat: place.geometry.location.lat,
//           lng: place.geometry.location.lng
//         } : null
//       };

//     } catch (error) {
//       console.error('❌ Get place details error:', error.message);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Calculate distance between two points
//    */
//   async calculateDistance(origin, destination, mode = 'driving') {
//     try {
//       const response = await this.client.distancematrix({
//         params: {
//           origins: [typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`],
//           destinations: [typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`],
//           mode: mode,
//           key: this.apiKey
//         }
//       });

//       if (response.data.status !== 'OK') {
//         throw new Error(`Distance Matrix API error: ${response.data.status}`);
//       }

//       const element = response.data.rows[0].elements[0];

//       if (element.status !== 'OK') {
//         return {
//           success: false,
//           error: element.status
//         };
//       }

//       return {
//         success: true,
//         distance: element.distance.text,
//         distance_value: element.distance.value,
//         duration: element.duration.text,
//         duration_value: element.duration.value,
//         duration_in_traffic: element.duration_in_traffic 
//           ? element.duration_in_traffic.text 
//           : element.duration.text,
//         mode: mode
//       };

//     } catch (error) {
//       console.error('❌ Calculate distance error:', error.message);
//       return {
//         success: false,
//         error: error.message,
//         distance: 'Unknown',
//         distance_value: 0
//       };
//     }
//   }

//   /**
//    * Nearby search for popular places
//    */
//   async nearbySearch({ location, radius = 2000, type, min_rating = 4.0, keyword, limit = 10 }) {
//     try {
//       console.log(`🔍 Nearby search around (${location.lat}, ${location.lng})`);

//       const params = {
//         location: `${location.lat},${location.lng}`,
//         radius: radius,
//         key: this.apiKey
//       };

//       if (type) params.type = type;
//       if (keyword) params.keyword = keyword;

//       const response = await this.client.placesNearby({ params });

//       if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
//         throw new Error(`Nearby Search API error: ${response.data.status}`);
//       }

//       let results = response.data.results || [];

//       // Filter by rating
//       results = results.filter(place => 
//         place.rating && place.rating >= min_rating
//       );

//       // Sort by rating
//       results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

//       // Limit results
//       results = results.slice(0, limit);

//       // Calculate distances
//       const distancePromises = results.map(place => 
//         this.calculateDistance(location, place.geometry.location, 'walking')
//       );
      
//       const distances = await Promise.all(distancePromises);

//       // Format results
//       const formattedResults = results.map((place, index) => ({
//         name: place.name,
//         place_id: place.place_id,
//         address: place.vicinity,
//         distance: distances[index].distance,
//         distance_meters: distances[index].distance_value,
//         rating: place.rating,
//         ratings_count: place.user_ratings_total || 0,
//         types: place.types || [],
//         open_now: place.opening_hours?.open_now || null,
//         location: {
//           lat: place.geometry.location.lat,
//           lng: place.geometry.location.lng
//         }
//       }));

//       console.log(`✅ Found ${formattedResults.length} nearby places`);

//       return {
//         success: true,
//         location: location,
//         radius: radius,
//         results: formattedResults,
//         total_results: formattedResults.length
//       };

//     } catch (error) {
//       console.error('❌ Nearby search error:', error.message);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Helper: Determine traffic level
//    */
//   getTrafficLevel(normalDuration, trafficDuration) {
//     const ratio = trafficDuration / normalDuration;
    
//     if (ratio < 1.1) return 'Light traffic';
//     if (ratio < 1.3) return 'Moderate traffic';
//     if (ratio < 1.5) return 'Heavy traffic';
//     return 'Very heavy traffic';
//   }
// }

// export default GoogleMapsService;


import { Client } from '@googlemaps/google-maps-services-js';

/**
 * Google Maps Service
 * Handles all Google Maps API interactions
 */

class GoogleMapsService {
  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not set');
    }
  }

  /**
   * Search for places
   */
  async searchPlaces({ query, location, radius = 3000, type, min_rating, open_now, limit = 10 }) {
    try {
      console.log(`🔍 Searching places: "${query}" near (${location.lat}, ${location.lng})`);

      // Use Text Search API
      const response = await this.client.textSearch({
        params: {
          query: query,
          location: `${location.lat},${location.lng}`,
          radius: radius,
          type: type,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }

      let results = response.data.results || [];

      // Filter by rating
      if (min_rating) {
        results = results.filter(place => place.rating >= min_rating);
      }

      // Filter by open_now
      if (open_now) {
        results = results.filter(place => 
          place.opening_hours && place.opening_hours.open_now === true
        );
      }

      // Limit results
      results = results.slice(0, limit);

      // Calculate distances only (cheap!)
      const distancePromises = results.map(place => 
        this.calculateDistance(location, place.geometry.location, 'driving')
      );
      
      const distances = await Promise.all(distancePromises);

      // Format results without phone/website (users can ask for details later)
      const formattedResults = results.map((place, index) => ({
        name: place.name,
        place_id: place.place_id,
        address: place.formatted_address,
        distance: distances[index].distance,
        distance_meters: distances[index].distance_value,
        rating: place.rating || null,
        ratings_count: place.user_ratings_total || 0,
        price_level: place.price_level || null,
        open_now: place.opening_hours?.open_now || null,
        phone: null,  // Users can call get_place_details to get this
        website: null,  // Users can call get_place_details to get this
        types: place.types || [],
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        }
      }));

      console.log(`✅ Found ${formattedResults.length} places`);

      return {
        success: true,
        query: query,
        location: location,
        results: formattedResults,
        total_results: formattedResults.length
      };

    } catch (error) {
      console.error('❌ Search places error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get directions between two points
   */
  async getDirections({ origin, destination, mode = 'driving', alternatives = true, avoid = [], departure_time, arrival_time }) {
    try {
      console.log(`🗺️ Getting directions: ${mode} mode`);

      // Handle destination as string or coordinates
      const destParam = typeof destination === 'string' 
        ? destination 
        : `${destination.lat},${destination.lng}`;

      const params = {
        origin: `${origin.lat},${origin.lng}`,
        destination: destParam,
        mode: mode,
        alternatives: alternatives,
        key: this.apiKey
      };

      // Add optional parameters
      if (avoid.length > 0) {
        params.avoid = avoid.join('|');
      }

      if (departure_time) {
        params.departure_time = new Date(departure_time).getTime() / 1000;
      }

      if (arrival_time && mode === 'transit') {
        params.arrival_time = new Date(arrival_time).getTime() / 1000;
      }

      const response = await this.client.directions({ params });

      if (response.data.status !== 'OK') {
        throw new Error(`Directions API error: ${response.data.status}`);
      }

      const routes = response.data.routes.map(route => {
        const leg = route.legs[0]; // First leg for single-leg journey

        return {
          summary: route.summary,
          distance: leg.distance.text,
          distance_value: leg.distance.value,
          duration: leg.duration.text,
          duration_value: leg.duration.value,
          duration_in_traffic: leg.duration_in_traffic 
            ? leg.duration_in_traffic.text 
            : leg.duration.text,
          steps: leg.steps.map(step => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML
            distance: step.distance.text,
            duration: step.duration.text,
            start_location: {
              lat: step.start_location.lat,
              lng: step.start_location.lng
            },
            end_location: {
              lat: step.end_location.lat,
              lng: step.end_location.lng
            },
            travel_mode: step.travel_mode
          })),
          traffic_info: leg.duration_in_traffic 
            ? this.getTrafficLevel(leg.duration.value, leg.duration_in_traffic.value)
            : null,
          warnings: route.warnings || []
        };
      });

      console.log(`✅ Found ${routes.length} route(s)`);

      return {
        success: true,
        origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
        destination: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
        mode: mode,
        routes: routes
      };

    } catch (error) {
      console.error('❌ Get directions error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get detailed place information
   */
  async getPlaceDetails({ place_id, place_name, location, fields }) {
    try {
      let placeId = place_id;

      // If place_name provided, find place_id first
      if (!placeId && place_name) {
        const searchResult = await this.searchPlaces({
          query: place_name,
          location: location,
          limit: 1
        });

        if (searchResult.success && searchResult.results.length > 0) {
          placeId = searchResult.results[0].place_id;
        } else {
          throw new Error(`Place "${place_name}" not found`);
        }
      }

      if (!placeId) {
        throw new Error('Either place_id or place_name is required');
      }

      console.log(`📍 Getting details for place: ${placeId}`);

      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: fields || [
            'name', 'formatted_address', 'formatted_phone_number',
            'website', 'rating', 'user_ratings_total', 'price_level',
            'opening_hours', 'reviews', 'photos', 'types', 'geometry'
          ].join(','),
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Place Details API error: ${response.data.status}`);
      }

      const place = response.data.result;

      return {
        success: true,
        name: place.name,
        place_id: placeId,
        formatted_address: place.formatted_address,
        phone: place.formatted_phone_number || null,
        website: place.website || null,
        rating: place.rating || null,
        ratings_count: place.user_ratings_total || 0,
        price_level: place.price_level || null,
        opening_hours: place.opening_hours ? {
          open_now: place.opening_hours.open_now,
          weekday_text: place.opening_hours.weekday_text || [],
          periods: place.opening_hours.periods || []
        } : null,
        reviews: place.reviews ? place.reviews.slice(0, 5).map(review => ({
          author: review.author_name,
          rating: review.rating,
          text: review.text,
          time: new Date(review.time * 1000).toISOString(),
          relative_time: review.relative_time_description
        })) : [],
        photos: place.photos ? place.photos.slice(0, 5).map(photo => ({
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1920&photoreference=${photo.photo_reference}&key=${this.apiKey}`,
          width: photo.width,
          height: photo.height,
          attribution: photo.html_attributions?.[0] || ''
        })) : [],
        types: place.types || [],
        location: place.geometry ? {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        } : null
      };

    } catch (error) {
      console.error('❌ Get place details error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate distance between two points
   */
  async calculateDistance(origin, destination, mode = 'driving') {
    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`],
          destinations: [typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`],
          mode: mode,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Distance Matrix API error: ${response.data.status}`);
      }

      const element = response.data.rows[0].elements[0];

      if (element.status !== 'OK') {
        return {
          success: false,
          error: element.status
        };
      }

      return {
        success: true,
        distance: element.distance.text,
        distance_value: element.distance.value,
        duration: element.duration.text,
        duration_value: element.duration.value,
        duration_in_traffic: element.duration_in_traffic 
          ? element.duration_in_traffic.text 
          : element.duration.text,
        mode: mode
      };

    } catch (error) {
      console.error('❌ Calculate distance error:', error.message);
      return {
        success: false,
        error: error.message,
        distance: 'Unknown',
        distance_value: 0
      };
    }
  }

  /**
   * Nearby search for popular places
   */
  async nearbySearch({ location, radius = 2000, type, min_rating = 4.0, keyword, limit = 10 }) {
    try {
      console.log(`🔍 Nearby search around (${location.lat}, ${location.lng})`);

      const params = {
        location: `${location.lat},${location.lng}`,
        radius: radius,
        key: this.apiKey
      };

      if (type) params.type = type;
      if (keyword) params.keyword = keyword;

      const response = await this.client.placesNearby({ params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Nearby Search API error: ${response.data.status}`);
      }

      let results = response.data.results || [];

      // Filter by rating
      results = results.filter(place => 
        place.rating && place.rating >= min_rating
      );

      // Sort by rating
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

      // Limit results
      results = results.slice(0, limit);

      // Calculate distances only (cheap!)
      const distancePromises = results.map(place => 
        this.calculateDistance(location, place.geometry.location, 'walking')
      );
      
      const distances = await Promise.all(distancePromises);

      // Format results without phone/website (users can ask for details later)
      const formattedResults = results.map((place, index) => ({
        name: place.name,
        place_id: place.place_id,
        address: place.vicinity,
        distance: distances[index].distance,
        distance_meters: distances[index].distance_value,
        rating: place.rating,
        ratings_count: place.user_ratings_total || 0,
        types: place.types || [],
        open_now: place.opening_hours?.open_now || null,
        phone: null,  // Users can call get_place_details to get this
        website: null,  // Users can call get_place_details to get this
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        }
      }));

      console.log(`✅ Found ${formattedResults.length} nearby places`);

      return {
        success: true,
        location: location,
        radius: radius,
        results: formattedResults,
        total_results: formattedResults.length
      };

    } catch (error) {
      console.error('❌ Nearby search error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Determine traffic level
   */
  getTrafficLevel(normalDuration, trafficDuration) {
    const ratio = trafficDuration / normalDuration;
    
    if (ratio < 1.1) return 'Light traffic';
    if (ratio < 1.3) return 'Moderate traffic';
    if (ratio < 1.5) return 'Heavy traffic';
    return 'Very heavy traffic';
  }
}

export default GoogleMapsService;