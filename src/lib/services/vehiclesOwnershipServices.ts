import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

/**
 * Create a new vehicles ownership record.
 * @param {Omit<Tables<'vehicles_ownership'>, 'created_at'>} ownership - The ownership data (without created_at)
 * @returns {Promise<Tables<'vehicles_ownership'> | null>}
 */
export async function createVehiclesOwnership(ownership: Omit<Tables<'vehicles_ownership'>, 'created_at'>): Promise<Tables<'vehicles_ownership'> | null> {
  const { data, error } = await supabase
    .from('vehicles_ownership')
    .insert([ownership])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get a vehicles ownership record by user_id and vehicle_id.
 * @param {string} user_id - The user id
 * @param {string} vehicle_id - The vehicle id
 * @returns {Promise<Tables<'vehicles_ownership'> | null>}
 */
export async function getVehiclesOwnership(user_id: string, vehicle_id: string): Promise<Tables<'vehicles_ownership'> | null> {
  const { data, error } = await supabase
    .from('vehicles_ownership')
    .select('*')
    .eq('user_id', user_id)
    .eq('vehicle_id', vehicle_id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a vehicles ownership record by user_id and vehicle_id.
 * @param {string} user_id - The user id
 * @param {string} vehicle_id - The vehicle id
 * @param {Partial<Tables<'vehicles_ownership'>>} updates - The fields to update
 * @returns {Promise<Tables<'vehicles_ownership'> | null>}
 */
export async function updateVehiclesOwnership(user_id: string, vehicle_id: string, updates: Partial<Tables<'vehicles_ownership'>>): Promise<Tables<'vehicles_ownership'> | null> {
  const { data, error } = await supabase
    .from('vehicles_ownership')
    .update(updates)
    .eq('user_id', user_id)
    .eq('vehicle_id', vehicle_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a vehicles ownership record by user_id and vehicle_id.
 * @param {string} user_id - The user id
 * @param {string} vehicle_id - The vehicle id
 * @returns {Promise<void>}
 */
export async function deleteVehiclesOwnership(user_id: string, vehicle_id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicles_ownership')
    .delete()
    .eq('user_id', user_id)
    .eq('vehicle_id', vehicle_id);
  if (error) throw error;
}

/**
 * List all vehicles ownership records.
 * @returns {Promise<Tables<'vehicles_ownership'>[]>}
 */
export async function listVehiclesOwnerships(): Promise<Tables<'vehicles_ownership'>[]> {
  const { data, error } = await supabase
    .from('vehicles_ownership')
    .select('*');
  if (error) throw error;
  return data || [];
} 