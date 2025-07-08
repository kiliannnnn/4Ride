import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { waypoints } = await request.json();
    if (!waypoints || waypoints.length < 2) {
      return new Response(JSON.stringify({ error: 'At least two waypoints required' }), { status: 400 });
    }
    const origin = `${waypoints[0].lat},${waypoints[0].lon}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lon}`;
    const via = waypoints.slice(1, -1).map((wp: { lat: number, lon: number }) => `${wp.lat},${wp.lon}`).join('|');
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}`;
    if (via) url += `&waypoints=${via}`;
    url += `&mode=driving&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) {
      return new Response(JSON.stringify({ error: 'No route found', data }), { status: 404 });
    }
    const polyline = data.routes[0].overview_polyline.points;
    // Decode polyline to array of {lat, lon}
    function decodePolyline(encoded: string) {
      let points = [];
      let index = 0, len = encoded.length;
      let lat = 0, lng = 0;
      while (index < len) {
        let b, shift = 0, result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lon: lng / 1e5 });
      }
      return points;
    }
    const routePoints = decodePolyline(polyline);
    return new Response(JSON.stringify({ points: routePoints }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}; 