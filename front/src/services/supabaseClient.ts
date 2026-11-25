import { createClient } from '@supabase/supabase-js';

function cleanEnv(val: any, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  return val.replace(/['"]/g, '').trim() || fallback;
}

const supabaseUrl = cleanEnv(
  (import.meta as any).env?.VITE_SUPABASE_URL,
  'https://zhbntxnsdznpdqmjyxpp.supabase.co'
);

const supabaseAnonKey = cleanEnv(
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYm50eG5zZHpucGRxbWp5eHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MzA2NjQsImV4cCI6MjEwOTUwNjY2NH0.lITIAnyggVx19D8Re8zG1qZ6tzU_3YEVe7B1kGsg8uA'
);

const supabaseServiceKey = cleanEnv(
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYm50eG5zZHpucGRxbWp5eHBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzkzMDY2NCwiZXhwIjoyMTA5NTA2NjY0fQ.6HLb01zQpGGwn6Hp_HGt3MlMhl8M5i9wXMqxWEgUdwA'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Privileged client (service role) used by the local data-sync layer so
 * writes pass Row Level Security while the app still runs without a
 * Supabase Auth session. WARNING: this key must never ship to production
 * builds; move these calls behind n8n webhooks before going live.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Direct cloud creator for users (students, teachers, parents) into Supabase Auth & Profiles
 */
export async function createUserInSupabase(userData: {
  full_name: string;
  phone: string;
  email: string;
  password?: string;
  role?: 'student' | 'teacher' | 'parent' | 'assistant';
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const role = userData.role || 'student';
    const cleanPhone = userData.phone.trim();
    let cleanEmail = userData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const digits = cleanPhone.replace(/\D/g, '') || Date.now().toString();
      cleanEmail = `${role}.${digits}@eduflow.edu`;
    }
    const rawPwd = (userData.password || 'password123456').trim();
    const pwd = rawPwd.length < 6 ? rawPwd.padEnd(6, '0') : rawPwd;

    console.log(`[SupabaseClient] Registering ${role} (${cleanEmail}) to Supabase...`);

    // 1. Create User in Supabase Auth via Admin API
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: pwd,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name.trim(),
          role,
          phone: cleanPhone,
        },
      }),
    });

    let userId: string | null = null;
    const authData = await authRes.json();

    if (authRes.ok && authData?.id) {
      userId = authData.id;
    } else {
      console.log('[SupabaseClient] User might already exist in Auth, looking up Auth UUID...', authData);
      try {
        // Query auth users list to find matching user ID
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
        });
        const listData = await listRes.json();
        const found = listData?.users?.find(
          (u: any) => u.email?.toLowerCase() === cleanEmail || u.user_metadata?.phone === cleanPhone
        );
        if (found?.id) {
          userId = found.id;
        }
      } catch (listErr) {
        console.warn('[SupabaseClient] Lookup in auth users failed:', listErr);
      }

      // Fallback: check profiles table
      if (!userId) {
        try {
          const checkRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}&select=id`,
            {
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
            }
          );
          const existingUsers = await checkRes.json();
          if (Array.isArray(existingUsers) && existingUsers.length > 0) {
            userId = existingUsers[0].id;
          }
        } catch (checkErr) {
          console.warn('[SupabaseClient] Check existing profile error:', checkErr);
        }
      }
    }

    if (!userId) {
      console.warn('[SupabaseClient] Could not obtain Supabase user ID:', authData?.message || authData?.msg);
      return { success: false, error: authData?.message || 'Failed to create auth user in Supabase' };
    }

    console.log(`[SupabaseClient] Auth UUID secured: ${userId}. Upserting profile...`);

    // 2. Upsert directly into public.profiles table
    const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: userId,
        full_name: userData.full_name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role,
      }),
    });

    if (!profRes.ok) {
      const profErr = await profRes.json();
      console.warn('[SupabaseClient] Profile upsert note:', profErr);
    } else {
      console.log(`[SupabaseClient] Successfully synchronized profile for ${userData.full_name} (${userId})`);
    }

    return { success: true, id: userId };
  } catch (err: any) {
    console.warn('[SupabaseClient] Supabase direct register error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upload a study material file (مذكرة) to Supabase Storage.
 * Bucket: course-materials (created by supabase/setup2.sql).
 * Returns the public URL on success.
 */
export async function uploadMaterialFileToSupabase(file: File, teacherId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const bucket = 'course-materials';
    const safeName = file.name.replace(/[^\w.\-\u0600-\u06FF]+/g, '_');
    const path = `materials/${teacherId}/${Date.now()}-${safeName}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return { success: true, url: data.publicUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'storage upload failed' };
  }
}

/**
 * Delete a user from Supabase Auth (admin API). The profiles row and all
 * linked data cascade in the database; tolerate "not found" errors.
 */
export async function deleteAuthUserInSupabase(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { success: false, error: body || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'auth delete failed' };
  }
}

/**
 * Backwards compatible alias for createStudentInSupabase
 */
export async function createStudentInSupabase(studentData: {
  full_name: string;
  phone: string;
  email: string;
  password?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  return createUserInSupabase({ ...studentData, role: 'student' });
}

/**
 * Clean up test students from Supabase Auth & Profiles on Reset Data
 */
export async function resetSupabaseTestStudents(): Promise<void> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    const data = await res.json();
    if (!data.users || !Array.isArray(data.users)) return;

    const testUsers = data.users.filter(
      (u: any) => u.email && u.email.startsWith('stu.')
    );

    for (const u of testUsers) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });
    }
  } catch (err) {
    console.warn('Failed to clean test students in Supabase:', err);
  }
}
