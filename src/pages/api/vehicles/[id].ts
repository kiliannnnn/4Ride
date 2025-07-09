import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";
import { deleteVehicle } from "@/lib/services/vehiclesServices";
import { deleteVehiclesOwnership } from "@/lib/services/vehiclesOwnershipServices";

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const vehicleId = params.id;
    if (!vehicleId) {
      return new Response("Vehicle ID is required", { status: 400 });
    }

    // Get current user
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify ownership
    const { data: ownership, error: ownershipError } = await supabase
      .from('vehicles_ownership')
      .select('*')
      .eq('user_id', user.id)
      .eq('vehicle_id', vehicleId)
      .single();

    if (ownershipError || !ownership) {
      return new Response("Vehicle not found or access denied", { status: 404 });
    }

    // Delete ownership relationship first
    await deleteVehiclesOwnership(user.id, vehicleId);

    // Delete the vehicle
    await deleteVehicle(vehicleId);

    return new Response("Vehicle deleted successfully", { status: 200 });
  } catch (error: any) {
    console.error("Error deleting vehicle:", error);
    return new Response("Failed to delete vehicle: " + error.message, { status: 500 });
  }
}; 