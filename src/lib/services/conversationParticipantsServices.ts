import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

export async function createConversationParticipant(participant: Omit<Tables<'conversation_participants'>, 'created_at'>): Promise<Tables<'conversation_participants'> | null> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .insert([participant])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConversationParticipant(conversation_id: number, user_id: string): Promise<Tables<'conversation_participants'> | null> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversation_id)
    .eq('user_id', user_id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversationParticipant(conversation_id: number, user_id: string, updates: Partial<Tables<'conversation_participants'>>): Promise<Tables<'conversation_participants'> | null> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .update(updates)
    .eq('conversation_id', conversation_id)
    .eq('user_id', user_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversationParticipant(conversation_id: number, user_id: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversation_id)
    .eq('user_id', user_id);
  if (error) throw error;
}

export async function listConversationParticipants(): Promise<Tables<'conversation_participants'>[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function getParticipantsByConversation(conversationId: number): Promise<Tables<'conversation_participants'>[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return data || [];
}