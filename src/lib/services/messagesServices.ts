import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

export async function createMessage(message: Omit<Tables<'messages'>, 'id' | 'created_at' | 'updated_at'>): Promise<Tables<'messages'> | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert([message])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMessageById(id: number): Promise<Tables<'messages'> | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMessage(id: number, updates: Partial<Tables<'messages'>>): Promise<Tables<'messages'> | null> {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(id: number): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listMessages(): Promise<Tables<'messages'>[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function getMessagesByConversation(conversationId: number): Promise<Tables<'messages'>[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}