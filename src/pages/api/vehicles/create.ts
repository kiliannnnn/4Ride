import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";
import { createVehicle } from "@/lib/services/vehiclesServices";
import { createVehiclesOwnership } from "@/lib/services/vehiclesOwnershipServices";

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  try {
    const formData = await request.formData();
    const brand = formData.get("brand")?.toString();
    const model = formData.get("model")?.toString();
    const year = formData.get("year")?.toString();
    const engine_size = formData.get("engine_size")?.toString();
    const mileage = formData.get("mileage")?.toString();

    if (!brand || !model) {
      return new Response("Brand and model are required", { status: 400 });
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

    // Create vehicle
    const vehicleData = {
      brand: brand as any, // Type assertion for enum
      model: model,
      year: year ? parseInt(year) : null,
      engine_size: engine_size ? parseInt(engine_size) : null,
      mileage: mileage ? parseInt(mileage) : null,
    };

    const vehicle = await createVehicle(vehicleData);
    if (!vehicle) {
      return new Response("Failed to create vehicle", { status: 500 });
    }

    // Create ownership relationship
    await createVehiclesOwnership({
      user_id: user.id,
      vehicle_id: vehicle.id,
    });

    return redirect("/dashboard");
  } catch (error: any) {
    console.error("Error creating vehicle:", error);
    return new Response("Failed to create vehicle: " + error.message, { status: 500 });
  }
}; 