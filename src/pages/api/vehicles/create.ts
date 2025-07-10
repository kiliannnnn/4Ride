import type { APIRoute } from 'astro';
import { createVehicle } from '@/lib/services/vehiclesServices';
import { createVehiclesOwnership } from '@/lib/services/vehiclesOwnershipServices';

export const POST: APIRoute = async ({ request, locals }) => {
  let brand, model, year, engine_size, mileage;
  try {
    const body = await request.json();
    brand = body.brand;
    model = body.model;
    year = body.year;
    engine_size = body.engine_size;
    mileage = body.mileage;
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!brand) {
    return new Response('brand is required', { status: 400 });
  }
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }
  try {
    const vehicle = await createVehicle({
      brand,
      model: model ?? null,
      year: year ?? null,
      engine_size: engine_size ?? null,
      mileage: mileage ?? null,
    });
    if (!vehicle) {
      return new Response(JSON.stringify({ error: 'Failed to create vehicle' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const ownership = await createVehiclesOwnership({
      user_id: locals.sb_user.id,
      vehicle_id: vehicle.id
    });
    return new Response(JSON.stringify({ vehicle, ownership }), {
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