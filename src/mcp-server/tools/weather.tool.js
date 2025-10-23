export async function weatherTool({ location }) {
  try {
    // Step 1: Geocode the location to get coordinates
    // Use more lenient search parameters
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=10&language=en&format=json`
    );
    
    if (!geoResponse.ok) {
      throw new Error('Failed to fetch location data');
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Location "${location}" not found. Try using just the city name (e.g., "Bali" or "Denpasar")`);
    }
    
    // Get the first result (most relevant)
    const { latitude, longitude, name, country, admin1 } = geoData.results[0];
    
    // Build a nice location string
    const locationName = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
    
    // Step 2: Get weather data using coordinates
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`
    );
    
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    
    // Map weather codes to descriptions
    const weatherDescriptions = {
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
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
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
    
    // Get wind direction in text
    const getWindDirection = (degrees) => {
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const index = Math.round(degrees / 45) % 8;
      return directions[index];
    };
    
    return {
      location: locationName,
      coordinates: { 
        latitude: latitude.toFixed(4), 
        longitude: longitude.toFixed(4) 
      },
      temperature: `${Math.round(current.temperature_2m)}°C`,
      feelsLike: `${Math.round(current.apparent_temperature)}°C`,
      condition: weatherDescriptions[current.weather_code] || 'Unknown',
      humidity: `${current.relative_humidity_2m}%`,
      windSpeed: `${Math.round(current.wind_speed_10m)} km/h`,
      windDirection: `${getWindDirection(current.wind_direction_10m)} (${current.wind_direction_10m}°)`,
      timestamp: current.time,
      timezone: weatherData.timezone
    };
    
  } catch (error) {
    // Better error logging
    console.error('Weather tool error details:', error);
    throw new Error(`Weather fetch failed: ${error.message}`);
  }
}