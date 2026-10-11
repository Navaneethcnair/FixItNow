import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes('YOUR_PROJECT_REF');
}

export async function createClient() {
  if (!isSupabaseConfigured()) {
    // Return a dummy server client when Supabase isn't configured
    const result = { data: null, error: null };
    const noopQuery: any = {
      select: () => noopQuery,
      eq: () => noopQuery,
      single: () => Promise.resolve(result),
      insert: () => noopQuery,
      update: () => noopQuery,
      delete: () => noopQuery,
      order: () => noopQuery,
      limit: () => noopQuery,
      then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
      catch: (reject: any) => Promise.resolve(result).catch(reject),
    };

    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        exchangeCodeForSession: () => Promise.resolve({ data: null, error: null }),
      },
      from: () => noopQuery,
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    } as any;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if there exists middleware refreshing sessions.
          }
        },
      },
    }
  );
}

