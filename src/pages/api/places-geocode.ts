import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name } = await request.json();
    if (!name) {
      return new Response(JSON.stringify({ error: 'Missing name' }), { status: 400 });
    }
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
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
    return new Response(JSON.stringify({ error: 'No result' }), { status: 404 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}; 