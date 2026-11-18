import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/lib/session';
import { supabase, unwrap } from '@/lib/supabase';
import type { NotificationPrefs } from '@/lib/types';

import { getPushStatus, registerForPush, type PushStatus } from './push';

export const prefsKey = (userId: string) => ['notification-prefs', userId] as const;
export const pushStatusKey = ['push-status'] as const;

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Matches the column defaults, used until a row exists. */
export const DEFAULT_PREFS = { partner_activity: true, daily_digest: true, digest_hour: 8 } as const;

export function useNotificationPrefs() {
  const { userId } = useHousehold();
  return useQuery({
    queryKey: prefsKey(userId),
    queryFn: async () => {
      const row = unwrap(
        await supabase.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle(),
      ) as NotificationPrefs | null;
      return row ?? { user_id: userId, ...DEFAULT_PREFS, timezone: deviceTimeZone() };
    },
  });
}

export function useUpdateNotificationPrefs() {
  const { household, userId } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<NotificationPrefs, 'partner_activity' | 'daily_digest' | 'digest_hour'>>) =>
      unwrap(
        await supabase
          .from('notification_prefs')
          .upsert({ user_id: userId, household_id: household.id, timezone: deviceTimeZone(), ...patch })
          .select()
          .single(),
      ) as NotificationPrefs,
    onSuccess: (row) => queryClient.setQueryData(prefsKey(userId), row),
  });
}

/** Makes sure a prefs row exists (with this device's time zone) so the daily digest reaches the person. */
export async function ensurePrefsRow(userId: string, householdId: string) {
  const existing = unwrap(
    await supabase.from('notification_prefs').select('user_id, timezone').eq('user_id', userId).maybeSingle(),
  ) as { user_id: string; timezone: string } | null;
  const timezone = deviceTimeZone();
  if (!existing) {
    unwrap(await supabase.from('notification_prefs').insert({ user_id: userId, household_id: householdId, timezone }));
  } else if (existing.timezone !== timezone) {
    unwrap(await supabase.from('notification_prefs').update({ timezone, household_id: householdId }).eq('user_id', userId));
  }
}

export function usePushStatus() {
  return useQuery({ queryKey: pushStatusKey, queryFn: getPushStatus });
}

/** Asks for permission (if still possible) and registers this device. */
export function useEnablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => registerForPush({ ask: true }),
    onSuccess: (status: PushStatus) => queryClient.setQueryData(pushStatusKey, status),
  });
}
