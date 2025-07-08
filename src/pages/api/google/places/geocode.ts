import type { APIRoute } from 'astro';

/**
 * POST /api/google/places/geocode
 * 
 * Given a place name, returns the geocoded location (latitude, longitude), name, address, and place_id
 * using the Google Places Text Search API.
 * 
 * Request body (JSON):
 *   { "name": "City or place name" }
 * 
 * Response (200):
 *   {
 *     "lat": number,
 *     "lon": number,
 *     "name": string,
 *     "address": string,
 *     "place_id": string
 *   }
 * 
 * Response (404):
 *   { "error": "No result" }
 * 
 * Response (400):
 *   { "error": "Missing name" }
 * 
 * Response (500):
 *   { "error": "Unknown error" }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse the request body for the place name
    const { name } = await request.json();
    if (!name) {
      // Return 400 if name is missing
      return new Response(JSON.stringify({ error: 'Missing name' }), { status: 400 });
    }
    // Build the Google Places Text Search API URL
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${apiKey}`;
    // Fetch the geocoding result from Google
    const res = await fetch(url);
    const data = await res.json();
    // If results are found, return the first result's details
    if (data.results && data.results.length > 0) {
      const place = data.results[0];
      return new Response(JSON.stringify({
        lat: place.geometry.location.lat,
        lon: place.geometry.location.lng,
        name: place.name,
        address: place.formatted_address,
        place_id: place.place_id
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // No results found
    return new Response(JSON.stringify({ error: 'No result' }), { status: 404 });
  } catch (err: any) {
    // Handle unexpected errors
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}; 