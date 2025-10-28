// services/timezone-service.js
import { find } from 'geo-tz';

export function getTimezoneFromCoordinates(lat, lng) {
  try {
    // Validate coordinates
    if (!lat || !lng) {
      console.error('❌ Invalid coordinates provided');
      return 'Asia/Makassar'; // Default fallback
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.error('❌ Coordinates out of valid range');
      return 'Asia/Makassar'; // Default fallback
    }

    // Get timezone using geo-tz
    const timezones = find(lat, lng);
    
    if (timezones && timezones.length > 0) {
      const timezone = timezones[0]; // First result is most accurate
      console.log(`✅ Timezone detected: ${timezone} for coordinates (${lat}, ${lng})`);
      return timezone;
    }

    // No timezone found
    console.error(`⚠️ No timezone found for coordinates (${lat}, ${lng})`);
    return 'Asia/Makassar'; // Default fallback
    
  } catch (error) {
    console.error('❌ Error getting timezone:', error.message);
    return 'Asia/Makassar'; // Default fallback
  }
}

export function getCurrentTimeInTimezone(timezone) {
  try {
    const now = new Date();
    
    return {
      timezone: timezone,
      iso: now.toISOString(),
      localDate: now.toLocaleDateString('en-US', { 
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      localTime: now.toLocaleTimeString('en-US', { 
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      offset: now.toLocaleTimeString('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).split(' ').pop()
    };
  } catch (error) {
    console.error('❌ Error getting time in timezone:', error.message);
    return null;
  }
}

export function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}