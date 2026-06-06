import { supabase } from './supabase';

export async function uploadImage(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from('zapmenu').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) { console.error('[upload]', error); return null; }

  const { data } = supabase.storage.from('zapmenu').getPublicUrl(path);
  return data.publicUrl;
}
