import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold, useSession } from '@/lib/session';
import { supabase, unwrap } from '@/lib/supabase';
import type { Household, Member } from '@/lib/types';

export const membersKey = (householdId: string) => ['members', householdId] as const;

export function useMembers() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: membersKey(household.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('household_members')
          .select('*')
          .eq('household_id', household.id)
          .order('joined_at'),
      ) as Member[],
  });
}

/** Lookup of user id -> member, for avatars and "added by". */
export function useMemberMap(): Map<string, Member> {
  const { data } = useMembers();
  return new Map((data ?? []).map((m) => [m.user_id, m]));
}

export function useCreateHousehold() {
  const { refreshHousehold } = useSession();
  return useMutation({
    mutationFn: async (input: { name: string; displayName: string }) =>
      unwrap(
        await supabase.rpc('create_household', { p_name: input.name, p_display_name: input.displayName }),
      ) as Household,
    onSuccess: refreshHousehold,
  });
}

export function useJoinHousehold() {
  const { refreshHousehold } = useSession();
  return useMutation({
    mutationFn: async (input: { code: string; displayName: string }) =>
      unwrap(
        await supabase.rpc('join_household', { p_code: input.code, p_display_name: input.displayName }),
      ) as Household,
    onSuccess: refreshHousehold,
  });
}

export function useRenameHousehold() {
  const { household } = useHousehold();
  const { refreshHousehold } = useSession();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await supabase.from('households').update({ name }).eq('id', household.id).select().single()),
    onSuccess: refreshHousehold,
  });
}

export function useUpdateMyName() {
  const { household, userId } = useHousehold();
  const { refreshHousehold } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) =>
      unwrap(
        await supabase
          .from('household_members')
          .update({ display_name: displayName })
          .eq('household_id', household.id)
          .eq('user_id', userId)
          .select()
          .single(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKey(household.id) });
      await refreshHousehold();
    },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}
