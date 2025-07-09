import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

/**
 * Create a new user profile.
 * @param {Omit<Tables<'user_profile'>, 'id' | 'created_at'>} profile - The profile data (without id/created_at)
 * @returns {Promise<Tables<'user_profile'> | null>}
 */
export async function createUserProfile(profile: Omit<Tables<'user_profile'>, 'id' | 'created_at'>): Promise<Tables<'user_profile'> | null> {
  const { data, error } = await supabase
    .from('user_profile')
    .insert([profile])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get a user profile by its id.
 * @param {number} id - The user profile id
 * @returns {Promise<Tables<'user_profile'> | null>}
 */
export async function getUserProfileById(id: number): Promise<Tables<'user_profile'> | null> {
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a user profile by id.
 * @param {number} id - The user profile id
 * @param {Partial<Tables<'user_profile'>>} updates - The fields to update
 * @returns {Promise<Tables<'user_profile'> | null>}
 */
export async function updateUserProfile(id: number, updates: Partial<Tables<'user_profile'>>): Promise<Tables<'user_profile'> | null> {
  const { data, error } = await supabase
    .from('user_profile')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a user profile by id.
 * @param {number} id - The user profile id
 * @returns {Promise<void>}
 */
export async function deleteUserProfile(id: number): Promise<void> {
  const { error } = await supabase
    .from('user_profile')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * List all user profiles.
 * @returns {Promise<Tables<'user_profile'>[]>}
 */
export async function listUserProfiles(): Promise<Tables<'user_profile'>[]> {
  const { data, error } = await supabase
    .from('user_profile')
    .select('*');
  if (error) throw error;
  return data || [];
}
