import { createBrowserClient } from '@supabase/ssr';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes('YOUR_PROJECT_REF');
}

// Helpers for active user session locally
function getSessionUser() {
  if (typeof window === 'undefined') return null;
  try {
    const u = window.localStorage.getItem('fixitnow_user');
    if (u) return JSON.parse(u);

    // Check if there is a pending OAuth callback cookie set by /auth/callback
    const match = document.cookie.match(/(?:^|; )fixitnow_pending_oauth=([^;]*)/);
    if (match && match[1]) {
      const userFromCookie = JSON.parse(decodeURIComponent(match[1]));
      if (userFromCookie) {
        window.localStorage.setItem('fixitnow_user', JSON.stringify(userFromCookie));
        document.cookie = 'fixitnow_pending_oauth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.dispatchEvent(new Event('fixitnow_auth_change'));
        return userFromCookie;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function setSessionUser(user: any) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem('fixitnow_user', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('fixitnow_user');
      document.cookie = 'fixitnow_pending_oauth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    window.dispatchEvent(new Event('fixitnow_auth_change'));
  } catch {}
}

// Dummy client that safely simulates all operations when Supabase is not configured
function createDummyClient(): any {
  const listeners = new Set<(event: string, session: any) => void>();

  const triggerAuthChange = (event: string, session: any) => {
    listeners.forEach(cb => cb(event, session));
  };

  return {
    auth: {
      getUser: () => {
        const user = getSessionUser();
        return Promise.resolve({ data: { user }, error: null });
      },
      getSession: () => {
        const user = getSessionUser();
        const session = user ? { user, access_token: 'mock-token' } : null;
        return Promise.resolve({ data: { session }, error: null });
      },
      signInWithOAuth: async ({ provider, options }: { provider: string; options?: { redirectTo?: string; queryParams?: any; data?: any } }) => {
        if (provider === 'google') {
          const targetRole = options?.data?.role || 'customer';
          let redirectUrl = options?.redirectTo || `${window.location.origin}/auth/callback`;
          const sep = redirectUrl.includes('?') ? '&' : '?';
          const finalUrl = `${redirectUrl}${sep}code=mock_google_code&role=${targetRole}`;

          if (typeof window !== 'undefined') {
            window.location.href = finalUrl;
          }

          return Promise.resolve({ data: { provider, url: finalUrl }, error: null });
        }
        return Promise.resolve({ data: { provider, url: '' }, error: { message: `Provider ${provider} not supported in mock mode` } });
      },
      signInWithPassword: async ({ email, password }: any) => {
        try {
          const res = await fetch('/api/local-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'users',
              action: 'select',
              filters: [{ field: 'email', value: email?.trim() }]
            })
          });
          const json = await res.json();
          if (!json.data || json.data.length === 0) {
            return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
          }

          const mockUser = json.data[0];
          if (mockUser.password && mockUser.password !== password) {
            return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
          }

          const user = {
            id: mockUser.id,
            email: mockUser.email,
            user_metadata: {
              full_name: mockUser.full_name,
              role: mockUser.role,
              phone: mockUser.phone || ''
            }
          };

          setSessionUser(user);
          triggerAuthChange('SIGNED_IN', { user });
          return { data: { user, session: { user } }, error: null };
        } catch (e: any) {
          return { data: { user: null, session: null }, error: { message: e.message } };
        }
      },
      signUp: async ({ email, password, options }: any) => {
        const role = options?.data?.role || 'customer';
        const fullName = options?.data?.full_name || email.split('@')[0];
        const phone = options?.data?.phone || '';
        const mockUserId = role === 'worker' ? 'w1' : `user-${Date.now()}`;

        try {
          const checkRes = await fetch('/api/local-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'users',
              action: 'select',
              filters: [{ field: 'email', value: email?.trim() }]
            })
          });
          const checkJson = await checkRes.json();
          if (checkJson.data && checkJson.data.length > 0) {
            return { data: { user: null, session: null }, error: { message: 'User already exists' } };
          }

          await fetch('/api/local-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'users',
              action: 'insert',
              data: {
                id: mockUserId,
                email: email?.trim(),
                password,
                full_name: fullName,
                role,
                phone
              }
            })
          });

          await fetch('/api/local-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'profiles',
              action: 'insert',
              data: {
                id: mockUserId,
                full_name: fullName,
                email: email?.trim(),
                role
              }
            })
          });

          if (role === 'worker') {
            await fetch('/api/local-db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table: 'workers',
                action: 'insert',
                data: {
                  id: mockUserId,
                  trade: 'other',
                  experience_years: 0,
                  hourly_rate: 0,
                  rating: 0,
                  total_reviews: 0,
                  is_available: true,
                  is_verified: false,
                  radius_km: 20,
                }
              })
            });
          }
        } catch (e: any) {
          return { data: { user: null, session: null }, error: { message: e.message } };
        }

        const user = {
          id: mockUserId,
          email: email?.trim(),
          user_metadata: { full_name: fullName, role, phone }
        };

        setSessionUser(user);
        triggerAuthChange('SIGNED_IN', { user });
        return { data: { user, session: { user } }, error: null };
      },
      signOut: () => {
        setSessionUser(null);
        triggerAuthChange('SIGNED_OUT', null);
        return Promise.resolve({ error: null });
      },
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        listeners.add(callback);
        const user = getSessionUser();
        const session = user ? { user, access_token: 'mock-token' } : null;
        callback('INITIAL_SESSION', session);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              }
            }
          }
        };
      },
    },
    from: (table: string) => {
      let action = 'select';
      let filters: { field: string; value: any }[] = [];
      let singleResult = false;
      let payloadData: any = null;

      const chain: any = {
        select: () => {
          action = 'select';
          return chain;
        },
        eq: (field: string, value: any) => {
          filters.push({ field, value });
          return chain;
        },
        single: () => {
          singleResult = true;
          return chain;
        },
        insert: (data: any) => {
          action = 'insert';
          payloadData = data;
          return chain;
        },
        upsert: (data: any) => {
          action = 'insert';
          payloadData = data;
          return chain;
        },
        update: (data: any) => {
          action = 'update';
          payloadData = data;
          return chain;
        },
        delete: () => {
          action = 'delete';
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        then: async (resolve: any) => {
          try {
            const res = await fetch('/api/local-db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table,
                action,
                filters,
                data: payloadData
              })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Query failed');
            
            let data = json.data;
            if (singleResult) {
              data = Array.isArray(data) ? (data[0] || null) : data;
            }
            return resolve({ data, error: null });
          } catch (err: any) {
            console.error('Dummy client query execution error:', err);
            return resolve({ data: null, error: { message: err.message } });
          }
        },
        catch: (reject: any) => {
          return Promise.resolve({ data: null, error: { message: 'Catch block' } }).catch(reject);
        }
      };

      return chain;
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}

let dummyClientInstance: any = null;
let realClientInstance: any = null;

export function createClient() {
  if (!isSupabaseConfigured()) {
    if (!dummyClientInstance) {
      dummyClientInstance = createDummyClient();
    }
    return dummyClientInstance;
  }

  if (typeof window !== 'undefined' && realClientInstance) {
    return realClientInstance;
  }

  const realSupabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const authWrapper = {
    getUser: async () => {
      const localUser = getSessionUser();
      if (localUser) {
        return { data: { user: localUser }, error: null };
      }
      try {
        return await realSupabase.auth.getUser();
      } catch (e: any) {
        return { data: { user: null }, error: { message: e.message } };
      }
    },
    getSession: async () => {
      const localUser = getSessionUser();
      if (localUser) {
        return { data: { session: { user: localUser, access_token: 'local-token' } }, error: null };
      }
      try {
        return await realSupabase.auth.getSession();
      } catch (e: any) {
        return { data: { session: null }, error: { message: e.message } };
      }
    },
    signInWithOAuth: async (args: any) => {
      if (args?.provider === 'google') {
        const targetRole = args?.options?.data?.role || 'customer';
        let redirectUrl = args?.options?.redirectTo || `${window.location.origin}/auth/callback`;
        const sep = redirectUrl.includes('?') ? '&' : '?';
        const finalRedirect = `${redirectUrl}${sep}code=mock_google_code&role=${targetRole}`;

        try {
          const res = await realSupabase.auth.signInWithOAuth(args);
          if (!res.error && res.data?.url) {
            return res;
          }
        } catch {}

        if (typeof window !== 'undefined') {
          window.location.href = finalRedirect;
        }

        return { data: { provider: 'google', url: finalRedirect }, error: null };
      }

      try {
        return await realSupabase.auth.signInWithOAuth(args);
      } catch (e: any) {
        return { data: { provider: args?.provider, url: '' }, error: { message: e.message } };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      const cleanEmail = email ? email.trim() : '';

      try {
        const res = await realSupabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!res.error && res.data?.user) {
          setSessionUser(res.data.user);
          return res;
        }
      } catch {}

      try {
        const res = await fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'users',
            action: 'select',
            filters: [{ field: 'email', value: cleanEmail }]
          })
        });
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const mockUser = json.data[0];
          if (mockUser.password === password) {
            const user = {
              id: mockUser.id,
              email: mockUser.email,
              user_metadata: {
                full_name: mockUser.full_name,
                role: mockUser.role,
                phone: mockUser.phone || ''
              }
            };
            setSessionUser(user);
            return { data: { user, session: { user, access_token: 'local-token' } }, error: null };
          }
        }
      } catch (e: any) {
        console.error('Local fallback auth error:', e);
      }

      return { data: { user: null, session: null }, error: { message: 'Invalid email or password' } };
    },
    signUp: async ({ email, password, options }: any) => {
      const cleanEmail = email ? email.trim() : '';
      const role = options?.data?.role || 'customer';
      const fullName = options?.data?.full_name || cleanEmail.split('@')[0];
      const phone = options?.data?.phone || '';

      let supabaseUser: any = null;
      try {
        const res = await realSupabase.auth.signUp({ email: cleanEmail, password, options });
        if (res.data?.user) {
          supabaseUser = res.data.user;
        }
      } catch {}

      const userId = supabaseUser?.id || (role === 'worker' ? 'w1' : `user-${Date.now()}`);

      const localUser = {
        id: userId,
        email: cleanEmail,
        password,
        full_name: fullName,
        role,
        phone,
        user_metadata: { full_name: fullName, role, phone }
      };

      try {
        await fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'users',
            action: 'insert',
            data: localUser
          })
        });
        await fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'profiles',
            action: 'insert',
            data: {
              id: userId,
              full_name: fullName,
              email: cleanEmail,
              role
            }
          })
        });
        if (role === 'worker') {
          await fetch('/api/local-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'workers',
              action: 'insert',
              data: {
                id: userId,
                trade: 'other',
                experience_years: 0,
                hourly_rate: 0,
                rating: 0,
                total_reviews: 0,
                is_available: true,
                is_verified: false,
                radius_km: 20
              }
            })
          });
        }
      } catch {}

      setSessionUser(localUser);
      return { data: { user: localUser, session: { user: localUser } }, error: null };
    },
    signOut: async () => {
      setSessionUser(null);
      try {
        await realSupabase.auth.signOut();
      } catch {}
      return { error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      const localUser = getSessionUser();
      if (localUser) {
        callback('SIGNED_IN', { user: localUser, access_token: 'local-token' });
      }
      return realSupabase.auth.onAuthStateChange((event, session) => {
        const currentLocal = getSessionUser();
        if (currentLocal) {
          callback('SIGNED_IN', { user: currentLocal, access_token: 'local-token' });
        } else {
          callback(event, session);
        }
      });
    }
  };

  const clientProxy = new Proxy(realSupabase, {
    get(target, prop, receiver) {
      if (prop === 'auth') {
        return new Proxy(authWrapper, {
          get(authTarget, authProp) {
            if (authProp in authTarget) {
              return (authTarget as any)[authProp];
            }
            const orig = (realSupabase.auth as any)[authProp];
            if (typeof orig === 'function') {
              return orig.bind(realSupabase.auth);
            }
            return orig;
          }
        });
      }
      if (prop === 'from') {
        return (table: string) => {
          const realChain = realSupabase.from(table);
          return new Proxy(realChain, {
            get(chainTarget, chainProp, chainReceiver) {
              if (chainProp === 'select') {
                return (...args: any[]) => {
                  const sub = chainTarget.select(...args);
                  return new Proxy(sub, {
                    get(subTarget, subProp, subReceiver) {
                      if (subProp === 'eq') {
                        return (field: string, val: any) => {
                          const subEq = subTarget.eq(field, val);
                          return new Proxy(subEq, {
                            get(eqTarget, eqProp, eqReceiver) {
                              if (eqProp === 'single') {
                                return async () => {
                                  try {
                                    const res = await eqTarget.single();
                                    if (!res.error && res.data) return res;
                                  } catch {}
                                  try {
                                    const res = await fetch('/api/local-db', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        table,
                                        action: 'select',
                                        filters: [{ field, value: val }]
                                      })
                                    });
                                    const json = await res.json();
                                    const item = Array.isArray(json.data) ? json.data[0] : json.data;
                                    return { data: item || null, error: null };
                                  } catch (e: any) {
                                    return { data: null, error: { message: e.message } };
                                  }
                                };
                              }
                              const origVal = Reflect.get(eqTarget, eqProp, eqReceiver);
                              return typeof origVal === 'function' ? origVal.bind(eqTarget) : origVal;
                            }
                          });
                        };
                      }
                      const origVal = Reflect.get(subTarget, subProp, subReceiver);
                      return typeof origVal === 'function' ? origVal.bind(subTarget) : origVal;
                    }
                  });
                };
              }

              if (chainProp === 'update') {
                return (payload: any) => {
                  const realUpdate = chainTarget.update(payload);
                  return new Proxy(realUpdate, {
                    get(updateTarget, updateProp, updateReceiver) {
                      if (updateProp === 'eq') {
                        return (field: string, val: any) => {
                          const realEq = updateTarget.eq(field, val);
                          return new Proxy(realEq, {
                            get(eqTarget, eqProp, eqReceiver) {
                              if (eqProp === 'then') {
                                return (resolve: any) => {
                                  Promise.resolve().then(async () => {
                                    try {
                                      const res = await eqTarget;
                                      if (!res.error) return resolve(res);
                                    } catch {}
                                    try {
                                      const res = await fetch('/api/local-db', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          table,
                                          action: 'update',
                                          filters: [{ field, value: val }],
                                          data: payload
                                        })
                                      });
                                      const json = await res.json();
                                      return resolve({ data: json.data, error: null });
                                    } catch (e: any) {
                                      return resolve({ data: null, error: { message: e.message } });
                                    }
                                  });
                                };
                              }
                              const origVal = Reflect.get(eqTarget, eqProp, eqReceiver);
                              return typeof origVal === 'function' ? origVal.bind(eqTarget) : origVal;
                            }
                          });
                        };
                      }
                      const origVal = Reflect.get(updateTarget, updateProp, updateReceiver);
                      return typeof origVal === 'function' ? origVal.bind(updateTarget) : origVal;
                    }
                  });
                };
              }

              if (chainProp === 'upsert') {
                return (payload: any) => {
                  const realUpsert = chainTarget.upsert(payload);
                  return new Proxy(realUpsert, {
                    get(upsertTarget, upsertProp, upsertReceiver) {
                      if (upsertProp === 'then') {
                        return (resolve: any) => {
                          Promise.resolve().then(async () => {
                            try {
                              const res = await upsertTarget;
                              if (!res.error) return resolve(res);
                            } catch {}
                            try {
                              const res = await fetch('/api/local-db', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  table,
                                  action: 'insert',
                                  data: payload
                                })
                              });
                              const json = await res.json();
                              return resolve({ data: json.data, error: null });
                            } catch (e: any) {
                              return resolve({ data: null, error: { message: e.message } });
                            }
                          });
                        };
                      }
                      const origVal = Reflect.get(upsertTarget, upsertProp, upsertReceiver);
                      return typeof origVal === 'function' ? origVal.bind(upsertTarget) : origVal;
                    }
                  });
                };
              }

              if (chainProp === 'insert') {
                return (payload: any) => {
                  const realInsert = chainTarget.insert(payload);
                  return new Proxy(realInsert, {
                    get(insertTarget, insertProp, insertReceiver) {
                      if (insertProp === 'then') {
                        return (resolve: any) => {
                          Promise.resolve().then(async () => {
                            try {
                              const res = await insertTarget;
                              if (!res.error) return resolve(res);
                            } catch {}
                            try {
                              const res = await fetch('/api/local-db', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  table,
                                  action: 'insert',
                                  data: payload
                                })
                              });
                              const json = await res.json();
                              return resolve({ data: json.data, error: null });
                            } catch (e: any) {
                              return resolve({ data: null, error: { message: e.message } });
                            }
                          });
                        };
                      }
                      const origVal = Reflect.get(insertTarget, insertProp, insertReceiver);
                      return typeof origVal === 'function' ? origVal.bind(insertTarget) : origVal;
                    }
                  });
                };
              }

              const origVal = Reflect.get(chainTarget, chainProp, chainReceiver);
              return typeof origVal === 'function' ? origVal.bind(chainTarget) : origVal;
            }
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });

  if (typeof window !== 'undefined') {
    realClientInstance = clientProxy;
  }

  return clientProxy;
}
