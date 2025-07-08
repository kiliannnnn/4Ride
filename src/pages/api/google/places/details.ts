import type { APIRoute } from 'astro';

/**
 * API route to fetch place details from Google Places API
 * 
 * This endpoint retrieves detailed information about a specific place using
 * the Google Places API. It requires a place_id and sessiontoken for
 * authentication and rate limiting purposes.
 * 
 * @param request - The incoming request containing place_id and sessiontoken
 * @returns JSON response with place details including geometry, name, and address
 */
export const POST: APIRoute = async ({ request }) => {
    const { place_id, sessiontoken } = await request.json();

    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry,name,formatted_address&key=${apiKey}&sessiontoken=${sessiontoken}`;

    const res = await fetch(url);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
}; 