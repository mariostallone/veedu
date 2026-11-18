// Offline support: persisted React Query cache, online detection and queued-mutation settings.
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager, type DehydrateOptions } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { cacheBuster, isReachable, retryDelay } from './domain';
import type { Household, Member } from './types';

/** How long cached data and queued changes are kept on the device. */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

/** Changes when the app version changes, which drops the persisted cache. */
export const cacheKey = cacheBuster(Constants.expoConfig?.version);

/** Feeds React Query's online state from NetInfo on phones (the browser's own events are used on web). */
export function connectOnlineManager() {
  if (Platform.OS === 'web') return;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isReachable(state))),
  );
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        retryDelay,
        // Cached data must outlive the persisted-cache max age to be written to storage.
        gcTime: CACHE_MAX_AGE,
        networkMode: 'online',
      },
      mutations: {
        // Offline changes pause and are replayed, in order, when the connection returns.
        networkMode: 'online',
        retry: 2,
        retryDelay,
        gcTime: CACHE_MAX_AGE,
      },
    },
  });
}

function webStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export const persister = createAsyncStoragePersister({
  storage: Platform.OS === 'web' ? webStorage() : AsyncStorage,
  key: 'veedu-query-cache',
  throttleTime: 1000,
});

/** Only successful queries and queued (paused) mutations that can be resumed are written to storage. */
export const dehydrateOptions: DehydrateOptions = {
  shouldDehydrateMutation: (m) => m.state.isPaused && m.options.mutationKey != null,
};

/** The household id from the cache, for queued creates that resume with no screen mounted. */
export function cachedHouseholdId(queryClient: QueryClient): string {
  for (const [, data] of queryClient.getQueriesData<{ household: Household; me: Member } | null>({
    queryKey: ['household'],
  })) {
    if (data?.household?.id) return data.household.id;
  }
  throw new Error('No household in the cache yet');
}
