import type { APIRoute } from 'astro';
import { updateVehicle } from '@/lib/services/vehiclesServices';

export const POST: APIRoute = async ({ request }) => {
  let id, updates;
  try {
    const body = await request.json();
    id = body.id;
    updates = body.updates;
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!id || !updates) {
    return new Response('id and updates are required', { status: 400 });
  }
  try {
    const vehicle = await updateVehicle(id, updates);
    return new Response(JSON.stringify({ vehicle }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to update vehicle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 