import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

export async function createConversation(conversation: Omit<Tables<'conversations'>, 'id' | 'created_at' | 'updated_at'>): Promise<Tables<'conversations'> | null> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([conversation])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConversationById(id: number): Promise<Tables<'conversations'> | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversation(id: number, updates: Partial<Tables<'conversations'>>): Promise<Tables<'conversations'> | null> {
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(id: number): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listConversations(): Promise<Tables<'conversations'>[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function getConversationsForUser(userId: string): Promise<Tables<'conversations'>[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_participants!inner(user_id)
    `)
    .eq('conversation_participants.user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}