import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LabelScan, NoteScanItem } from '@/lib/types';

import type { Photo } from './photo';

type Hints = { stores?: string[]; categories?: string[] };

/** Calls the `scan` Edge Function. The Claude key lives there as a Supabase secret, never in the app. */
async function invokeScan<T>(mode: 'label' | 'note', photo: Photo, hints: Hints): Promise<T> {
  const { data, error } = await supabase.functions.invoke('scan', {
    body: { mode, image: photo.base64, media_type: photo.mediaType, ...hints },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? 'The scan failed. Try again.');
    }
    throw new Error('Could not reach the scanning service. Check your connection and try again.');
  }
  return (data as { result: T }).result;
}

export function useScanLabel() {
  return useMutation({
    mutationFn: ({ photo, categories }: { photo: Photo; categories: string[] }) =>
      invokeScan<LabelScan>('label', photo, { categories }),
  });
}

export function useScanNote() {
  return useMutation({
    mutationFn: ({ photo, stores }: { photo: Photo; stores: string[] }) =>
      invokeScan<NoteScanItem[]>('note', photo, { stores }),
  });
}

export type OpenFoodFactsResult = { json: unknown } | { unreachable: true };

/** Looks a barcode up on Open Food Facts straight from the app (a free, keyless public API). */
export async function fetchOpenFoodFacts(code: string): Promise<OpenFoodFactsResult> {
  const fields = 'product_name,product_name_en,generic_name,quantity,categories,categories_tags';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
      { signal: controller.signal },
    );
    // Open Food Facts answers 404 with {status: 0} for unknown products.
    if (res.status === 404) return { json: { status: 0 } };
    if (!res.ok) return { unreachable: true };
    return { json: await res.json() };
  } catch {
    return { unreachable: true };
  } finally {
    clearTimeout(timer);
  }
}
