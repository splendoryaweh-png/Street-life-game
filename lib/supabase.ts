import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface StreetPost {
  id: string;
  user_id: string;
  username: string;
  file_url: string;
  file_type: 'audio' | 'video';
  beat: string;
  duration: number;
  created_at: string;
}

const LOCAL_POSTS_KEY = 'street_life_posts_v1';

export async function uploadFreestyleToSupabase({
  userId,
  username,
  fileBlob,
  fileType,
  beat,
  duration,
}: {
  userId: string;
  username: string;
  fileBlob: Blob;
  fileType: 'audio' | 'video';
  beat: string;
  duration: number;
}): Promise<{ success: boolean; post: StreetPost; error?: string }> {
  const timestamp = Date.now();
  const extension = fileType === 'video' ? 'webm' : 'mp3';
  const fileName = `${userId}_${timestamp}.${extension}`;
  let fileUrl = '';

  // 1. Attempt upload to Supabase bucket 'freestyles'
  if (supabase) {
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('freestyles')
        .upload(fileName, fileBlob, {
          contentType: fileType === 'video' ? 'video/webm' : 'audio/webm',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('freestyles')
          .getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
      }
    } catch (e) {
      console.warn('Supabase storage upload notice:', e);
    }
  }

  // Fallback to local object URL if no remote storage url was generated
  if (!fileUrl) {
    fileUrl = URL.createObjectURL(fileBlob);
  }

  const newPost: StreetPost = {
    id: `post_${timestamp}`,
    user_id: userId,
    username: username || 'Street Hustler',
    file_url: fileUrl,
    file_type: fileType,
    beat,
    duration,
    created_at: new Date().toISOString(),
  };

  // 2. Insert into Supabase table 'street_posts'
  if (supabase) {
    try {
      await supabase.from('street_posts').insert([
        {
          user_id: newPost.user_id,
          username: newPost.username,
          file_url: newPost.file_url,
          file_type: newPost.file_type,
          beat: newPost.beat,
          duration: newPost.duration,
          created_at: newPost.created_at,
        },
      ]);
    } catch (e) {
      console.warn('Supabase table insert notice:', e);
    }
  }

  // 3. Always cache in local storage so feed is instantly visible & resilient
  if (typeof window !== 'undefined') {
    try {
      const existing = getLocalStreetPosts();
      existing.unshift(newPost);
      localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(existing.slice(0, 30)));
    } catch (e) {
      console.warn('Local storage cache error:', e);
    }
  }

  return { success: true, post: newPost };
}

export function getLocalStreetPosts(): StreetPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
