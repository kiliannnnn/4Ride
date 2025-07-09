import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

/**
 * Create a new vehicle.
 * @param {Omit<Tables<'vehicles'>, 'id' | 'created_at' | 'updated_at'>} vehicle - The vehicle data (without id/timestamps)
 * @returns {Promise<Tables<'vehicles'> | null>}
 */
export async function createVehicle(vehicle: Omit<Tables<'vehicles'>, 'id' | 'created_at' | 'updated_at'>): Promise<Tables<'vehicles'> | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert([vehicle])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get a vehicle by its id.
 * @param {string} id - The vehicle id
 * @returns {Promise<Tables<'vehicles'> | null>}
 */
export async function getVehicleById(id: string): Promise<Tables<'vehicles'> | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a vehicle by id.
 * @param {string} id - The vehicle id
 * @param {Partial<Tables<'vehicles'>>} updates - The fields to update
 * @returns {Promise<Tables<'vehicles'> | null>}
 */
export async function updateVehicle(id: string, updates: Partial<Tables<'vehicles'>>): Promise<Tables<'vehicles'> | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a vehicle by id.
 * @param {string} id - The vehicle id
 * @returns {Promise<void>}
 */
export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * List all vehicles.
 * @returns {Promise<Tables<'vehicles'>[]>}
 */
export async function listVehicles(): Promise<Tables<'vehicles'>[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*');
  if (error) throw error;
  return data || [];
} 