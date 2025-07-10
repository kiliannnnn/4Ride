import type { APIRoute } from 'astro';
import { createVehicle } from '@/lib/services/vehiclesServices';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    // Accept brand, model, year, engine_size, mileage (optional fields)
    const { brand, model, year, engine_size, mileage } = body;
    if (!brand) {
      return new Response(JSON.stringify({ error: 'brand is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const vehicle = await createVehicle({
      brand,
      model: model ?? null,
      year: year ?? null,
      engine_size: engine_size ?? null,
      mileage: mileage ?? null,
    });
    return new Response(JSON.stringify({ vehicle }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to create vehicle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 