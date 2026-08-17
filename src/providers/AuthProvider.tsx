import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { useProfile } from '../api/profile';
import { queryClient, queryKeys } from '../providers/QueryProvider';
import { createSimulatorState } from '../domain/storeSimulator';
import { useLocalServerStore } from '../store/useLocalServerStore';
import type { User } from '../types';
import { toE164 } from '../utils/phone';

type AuthPhase = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextValue {
  phase: AuthPhase;
  session: Session | null;
  user: User | null;
  sendOtp: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (phone: string, token: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const { data: profile, refetch: refetchProfile } = useProfile();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setPhase('signed_out');
      return;
    }

    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPhase(data.session ? 'signed_in' : 'signed_out');
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setPhase(nextSession ? 'signed_in' : 'signed_out');
      if (nextSession) {
        queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Supabase is not configured. Add env vars to sign in.' };
    }
    try {
      const { error } = await getSupabase().auth.signInWithOtp({ phone: toE164(phone) });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to send code.' };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string, name?: string) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Supabase is not configured.' };
    }
    try {
      const { data, error } = await getSupabase().auth.verifyOtp({
        phone: toE164(phone),
        token,
        type: 'sms',
      });
      if (error) return { ok: false, error: error.message };

      if (data.user && name?.trim()) {
        await getSupabase()
          .from('profiles')
          .update({ name: name.trim() })
          .eq('id', data.user.id);
      }

      await refetchProfile();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Verification failed.' };
    }
  }, [refetchProfile]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await getSupabase().auth.signOut();
    }
    useLocalServerStore.setState({ sim: createSimulatorState(), localGuest: null });
    queryClient.clear();
    setSession(null);
    setPhase('signed_out');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      phase,
      session,
      user: profile ?? null,
      sendOtp,
      verifyOtp,
      logout,
      refreshProfile: () => refetchProfile(),
    }),
    [phase, session, profile, sendOtp, verifyOtp, logout, refetchProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
