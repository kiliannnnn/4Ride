import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";
import { updateVehicle } from "@/lib/services/vehiclesServices";

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  try {
    const formData = await request.formData();
    const vehicleId = formData.get("vehicle_id")?.toString();
    const brand = formData.get("brand")?.toString();
    const model = formData.get("model")?.toString();
    const year = formData.get("year")?.toString();
    const engine_size = formData.get("engine_size")?.toString();
    const mileage = formData.get("mileage")?.toString();

    if (!vehicleId || !brand || !model) {
      return new Response("Vehicle ID, brand and model are required", { status: 400 });
    }

    // Get current user
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return redirect("/signin");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return redirect("/signin");
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

    // Update vehicle
    const vehicleData = {
      brand: brand as any, // Type assertion for enum
      model: model,
      year: year ? parseInt(year) : null,
      engine_size: engine_size ? parseInt(engine_size) : null,
      mileage: mileage ? parseInt(mileage) : null,
    };

    const updatedVehicle = await updateVehicle(vehicleId, vehicleData);
    if (!updatedVehicle) {
      return new Response("Failed to update vehicle", { status: 500 });
    }

    return redirect("/dashboard");
  } catch (error: any) {
    console.error("Error updating vehicle:", error);
    return new Response("Failed to update vehicle: " + error.message, { status: 500 });
  }
}; 