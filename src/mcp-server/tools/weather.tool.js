/**
 * Get weather data using Open-Meteo API
 * Supports both location name and user coordinates
 */
export async function weatherTool({ location, user_location }) {
  try {
    let latitude, longitude, locationName;

    // Priority 1: Use user_location if provided
    if (user_location && user_location.lat && user_location.lng) {
      latitude = user_location.lat;
      longitude = user_location.lng;
      locationName = `${latitude}, ${longitude}`;
      console.error(`📍 Using user location: ${locationName}`);
    }
    // Priority 2: If location string provided, try to geocode it
    else if (location) {
      console.error(`📍 Geocoding location: ${location}`);
      const geocoded = await geocodeLocation(location);
      if (geocoded) {
        latitude = geocoded.lat;
        longitude = geocoded.lng;
        locationName = geocoded.name;
      } else {
        return {
          success: false,
          error: `Could not find coordinates for location: ${location}`
        };
      }
    }
    // No location data provided
    else {
      return {
        success: false,
        error: 'No location provided. Please specify a location or enable location services.'
      };
    }

    // Fetch weather data from Open-Meteo API
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`
    );

    if (!weatherResponse.ok) {
      throw new Error(`Weather API returned status ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;

    // Map weather codes to descriptions
    const weatherDescription = getWeatherDescription(current.weather_code);

    const result = {
      success: true,
      location: locationName,
      coordinates: { lat: latitude, lng: longitude },
      temperature: `${current.temperature_2m}°C`,
      feels_like: `${current.apparent_temperature}°C`,
      humidity: `${current.relative_humidity_2m}%`,
      wind_speed: `${current.wind_speed_10m} km/h`,
      wind_direction: `${current.wind_direction_10m}°`,
      condition: weatherDescription,
      timezone: weatherData.timezone,
      message: `Weather at ${locationName}: ${current.temperature_2m}°C, ${weatherDescription}`
    };

    console.error(`🌤️ Weather retrieved successfully for ${locationName}`);
    return result;

  } catch (error) {
    console.error('❌ Weather tool error:', error);
    return {
      success: false,
      error: `Failed to get weather: ${error.message}`
    };
  }
}

/**
 * Geocode location name to coordinates using Open-Meteo Geocoding API
 */
async function geocodeLocation(locationName) {
  try {
    const geocodeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`
    );

    if (!geocodeResponse.ok) {
      throw new Error('Geocoding failed');
    }

    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.results && geocodeData.results.length > 0) {
      const result = geocodeData.results[0];
      return {
        lat: result.latitude,
        lng: result.longitude,
        name: result.name,
        country: result.country
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return null;
  }
}

/**
 * Map WMO weather codes to human-readable descriptions
 * Source: https://open-meteo.com/en/docs
 */
function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };

  return weatherCodes[code] || 'Unknown';
}