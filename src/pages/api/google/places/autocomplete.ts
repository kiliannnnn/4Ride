import type { APIRoute } from 'astro';

/**
 * POST /api/google/places/autocomplete
 * 
 * Given a partial city or place name, returns autocomplete suggestions using the Google Places Autocomplete API.
 * 
 * Request body (JSON):
 *   { "input": "partial city name", "sessionToken": "unique-session-token" }
 * 
 * Response (200):
 *   Google Places Autocomplete API response (JSON)
 * 
 * Response (400):
 *   { "error": "Missing input" }
 * 
 * Response (500):
 *   { "error": "Unknown error" }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse the request body for the input and sessionToken
    const { input, sessionToken } = await request.json();
    if (!input) {
      // Return 400 if input is missing
      return new Response(JSON.stringify({ error: 'Missing input' }), { status: 400 });
    }
    // Build the Google Places Autocomplete API URL
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&key=${apiKey}&sessiontoken=${sessionToken}`;
    // Fetch autocomplete suggestions from Google
    const res = await fetch(url);
    const data = await res.json();
    // Return the autocomplete suggestions
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    // Handle unexpected errors
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}; 