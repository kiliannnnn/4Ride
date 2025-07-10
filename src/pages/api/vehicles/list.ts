import type { APIRoute } from 'astro';
import { listVehicles } from '@/lib/services/vehiclesServices';

export const GET: APIRoute = async () => {
  try {
    const vehicles = await listVehicles();
    const data = vehicles.map(({ brand, model, year, id }) => ({ brand, model, year, id }));
    return new Response(JSON.stringify({ vehicles: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch vehicles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 