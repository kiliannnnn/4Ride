import type { APIRoute } from 'astro';
import { decodePolyline } from '@/lib/services/googleServices';

/**
 * POST /api/google/directions/route
 * 
 * Expects a JSON body with a "waypoints" array of at least two objects, each with "lat" and "lon" properties.
 * 
 * Example request body:
 * {
 *   "waypoints": [
 *     { "lat": 40.7128, "lon": -74.0060 },
 *     { "lat": 41.8781, "lon": -87.6298 }
 *   ]
 * }
 * 
 * This endpoint:
 * - Validates that at least two waypoints are provided.
 * - Constructs a Google Maps Directions API request using the waypoints.
 * - Fetches the route from Google Maps.
 * - Decodes the returned polyline into an array of {lat, lon} points.
 * - Returns the decoded points as JSON.
 * 
 * Returns:
 * - 200: { points: Array<{lat: number, lon: number}> }
 * - 400: { error: string } if not enough waypoints
 * - 404: { error: string, data: any } if no route found
 * - 500: { error: string } on server error
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse waypoints from request body
    const { waypoints } = await request.json();

    // Validate waypoints
    if (!waypoints || waypoints.length < 2) {
      return new Response(JSON.stringify({ error: 'At least two waypoints required' }), { status: 400 });
    }

    // Build origin, destination, and via (intermediate) waypoints
    const origin = `${waypoints[0].lat},${waypoints[0].lon}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lon}`;
    const via = waypoints.slice(1, -1).map((wp: { lat: number, lon: number }) => `${wp.lat},${wp.lon}`).join('|');

    // Get Google Maps API key from environment
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY;

    // Construct Google Maps Directions API URL
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}`;
    if (via) url += `&waypoints=${via}`;
    url += `&mode=driving&key=${apiKey}`;

    // Fetch directions from Google Maps API
    const res = await fetch(url);
    const data = await res.json();

    // Check if a route was found
    if (!data.routes || !data.routes.length) {
      return new Response(JSON.stringify({ error: 'No route found', data }), { status: 404 });
    }

    // Extract and decode the polyline from the first route
    const polyline = data.routes[0].overview_polyline.points;

    // Decode the polyline to an array of points
    const routePoints = decodePolyline(polyline);

    // Return the decoded points as JSON
    return new Response(JSON.stringify({ points: routePoints }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    // Handle errors and return a 500 response
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
};