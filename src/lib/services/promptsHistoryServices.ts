import { supabase } from '@/lib/supabase';
import type { Tables } from '@/database.types';

export async function createPromptHistory(promptHistory: Omit<Tables<'prompts_history'>, 'id' | 'created_at'>): Promise<Tables<'prompts_history'> | null> {
  const { data, error } = await supabase
    .from('prompts_history')
    .insert([promptHistory])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPromptHistoryById(id: number): Promise<Tables<'prompts_history'> | null> {
  const { data, error } = await supabase
    .from('prompts_history')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePromptHistory(id: number, updates: Partial<Tables<'prompts_history'>>): Promise<Tables<'prompts_history'> | null> {
  const { data, error } = await supabase
    .from('prompts_history')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePromptHistory(id: number): Promise<void> {
  const { error } = await supabase
    .from('prompts_history')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listPromptsHistory(): Promise<Tables<'prompts_history'>[]> {
  const { data, error } = await supabase
    .from('prompts_history')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function getPromptsHistoryByUser(userId: string, limit?: number): Promise<Tables<'prompts_history'>[]> {
  let query = supabase
    .from('prompts_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (limit) {
    query = query.limit(limit);
  }
    
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}