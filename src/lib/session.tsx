import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase, unwrap } from './supabase';
import type { Household, Member } from './types';

type SessionState = {
  /** True until the stored session and (if signed in) the household have loaded. */
  loading: boolean;
  session: Session | null;
  userId: string | null;
  household: Household | null;
  /** The signed-in person's membership row (name, colour). */
  me: Member | null;
  refreshHousehold: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export const householdKey = (userId: string | null) => ['household', userId] as const;

async function fetchMembership(userId: string): Promise<{ household: Household; me: Member } | null> {
  const rows = unwrap(
    await supabase
      .from('household_members')
      .select('*, households(*)')
      .eq('user_id', userId)
      .limit(1),
  ) as (Member & { households: Household })[];
  const row = rows[0];
  if (!row) return null;
  const { households, ...me } = row;
  return { household: households, me };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id ?? null;
  const membership = useQuery({
    queryKey: householdKey(userId),
    queryFn: () => fetchMembership(userId!),
    enabled: !!userId,
  });

  const value: SessionState = {
    loading: !sessionLoaded || (!!userId && membership.isPending),
    session,
    userId,
    household: membership.data?.household ?? null,
    me: membership.data?.me ?? null,
    refreshHousehold: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** For screens inside the signed-in app, where a household is guaranteed by the root guard. */
export function useHousehold(): { household: Household; me: Member; userId: string } {
  const { household, me, userId } = useSession();
  if (!household || !me || !userId) throw new Error('useHousehold used outside the signed-in app');
  return { household, me, userId };
}
