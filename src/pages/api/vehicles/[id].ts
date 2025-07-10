import type { APIRoute } from 'astro';
import { getVehicleById, deleteVehicle } from '@/lib/services/vehiclesServices';

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response('id is required', { status: 400 });
  }
  try {
    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      return new Response('Vehicle not found', { status: 404 });
    }
    return new Response(JSON.stringify({ vehicle }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to fetch vehicle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) {
    return new Response('id is required', { status: 400 });
  }
  try {
    await deleteVehicle(id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to delete vehicle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 