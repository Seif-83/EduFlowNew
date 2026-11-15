import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zhbntxnsdznpdqmjyxpp.supabase.co';

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYm50eG5zZHpucGRxbWp5eHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MzA2NjQsImV4cCI6MjEwOTUwNjY2NH0.lITIAnyggVx19D8Re8zG1qZ6tzU_3YEVe7B1kGsg8uA';

const supabaseServiceKey =
  (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYm50eG5zZHpucGRxbWp5eHBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzkzMDY2NCwiZXhwIjoyMTA5NTA2NjY0fQ.6HLb01zQpGGwn6Hp_HGt3MlMhl8M5i9wXMqxWEgUdwA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Direct cloud creator for students into Supabase Auth & Profiles
 */
export async function createStudentInSupabase(studentData: {
  full_name: string;
  phone: string;
  email: string;
  password?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: studentData.email,
        password: studentData.password || 'password123456',
        email_confirm: true,
        user_metadata: {
          full_name: studentData.full_name,
          role: 'student',
        },
      }),
    });

    const user = await res.json();
    if (!res.ok) {
      console.warn('Supabase auth create note:', user?.message || user?.msg);
      // If user already exists, patch their profile directly so the latest name & phone are updated
      try {
        const existingRes = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(studentData.email)}&select=id`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
        });
        const existingUsers = await existingRes.json();
        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
          const existingId = existingUsers[0].id;
          await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${existingId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              full_name: studentData.full_name,
              phone: studentData.phone,
              role: 'student',
            }),
          });
          return { success: true, id: existingId };
        }
      } catch (patchErr) {
        console.warn('Fallback patch error:', patchErr);
      }
      return { success: false, error: user?.message || user?.msg };
    }

    // Ensure profile has phone and arabic name
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        full_name: studentData.full_name,
        phone: studentData.phone,
        role: 'student',
      }),
    });

    return { success: true, id: user.id };
  } catch (err: any) {
    console.warn('Supabase direct register network error:', err);
    return { success: false, error: err.message };
  }
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
