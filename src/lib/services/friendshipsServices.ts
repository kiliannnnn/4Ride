import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

export async function createFriendship(friendship: Omit<Tables<'friendships'>, 'id' | 'created_at' | 'updated_at'>): Promise<Tables<'friendships'> | null> {
  const { data, error } = await supabase
    .from('friendships')
    .insert([friendship])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFriendshipById(id: number): Promise<Tables<'friendships'> | null> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getPendingInvitesSender(userId: string): Promise<Tables<'friendships'>[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('user_1_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

export async function getPendingInvitesReceiver(userId: string): Promise<Tables<'friendships'>[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('user_2_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

export async function updateFriendship(id: number, updates: Partial<Tables<'friendships'>>): Promise<Tables<'friendships'> | null> {
  const { data, error } = await supabase
    .from('friendships')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFriendship(id: number): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listFriendships(): Promise<Tables<'friendships'>[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function getFriendshipByUser(userId: string): Promise<Tables<'friendships'>[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (error) throw error;
  return data || [];
}
