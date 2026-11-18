import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Caption, Card, Chip, ErrorNote, Row, Screen, SectionLabel } from '@/components/ui';
import { usePantry } from '@/features/pantry/api';
import { useScanLabel } from '@/features/scan/api';
import { PhotoCapture } from '@/features/scan/PhotoCapture';
import type { Photo } from '@/features/scan/photo';
import { DEFAULT_PANTRY_CATEGORIES, labelToPrefill, mergeSuggestions } from '@/lib/domain';
import type { LabelScan } from '@/lib/types';
import { space } from '@/theme';

/** Photograph a product label, check what was read, then finish in the normal pantry editor. */
export default function ScanLabel() {
  const pantry = usePantry();
  const scan = useScanLabel();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [label, setLabel] = useState<LabelScan | null>(null);
  const categories = mergeSuggestions((pantry.data ?? []).map((p) => p.category), DEFAULT_PANTRY_CATEGORIES);

  function analyse(next: Photo) {
    setPhoto(next);
    setLabel(null);
    scan.mutate({ photo: next, categories }, { onSuccess: setLabel });
  }

  // Reads are shown as-is; the editor lets you change anything before it is saved.
  const prefill = label ? labelToPrefill(label, categories) : null;
  const rows: { key: string; title: string; value: string | null }[] = label
    ? [
        { key: 'name', title: 'Name', value: label.name },
        { key: 'qty', title: 'Size', value: label.size !== null ? `${label.size}${label.unit ? ` ${label.unit}` : ''}` : null },
        { key: 'expiry', title: 'Expiry date', value: label.expires_on },
        { key: 'category', title: 'Category', value: prefill?.category ?? null },
      ]
    : [];

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Scan label' }} />
      <PhotoCapture
        hint="Photograph the front or back of a product so the name, size and expiry date can be read for you."
        photo={photo}
        busy={scan.isPending}
        onPhoto={analyse}
      />
      {scan.isPending ? <Body muted>Reading the label…</Body> : null}
      {scan.isError ? (
        <>
          <ErrorNote error={scan.error} />
          {photo ? <Button label="Try again" variant="secondary" onPress={() => analyse(photo)} /> : null}
        </>
      ) : null}

      {label && prefill ? (
        <>
          <SectionLabel>Check what was read</SectionLabel>
          <Card>
            {rows.map((r, i) => (
              <Row
                key={r.key}
                title={r.value ?? 'Not found'}
                subtitle={r.title}
                muted={r.value === null}
                last={i === rows.length - 1}
                right={r.value !== null ? <Chip label="read" tone="accent" /> : undefined}
              />
            ))}
          </Card>
          <Caption>Nothing is saved yet. You can change any field in the next step.</Caption>
          <Button
            label="Continue to edit"
            onPress={() => router.replace({ pathname: '/pantry/[id]', params: { id: 'new', ...prefill } })}
          />
          <Button label="Discard" variant="secondary" onPress={() => router.back()} />
        </>
      ) : null}
      <Caption style={{ paddingTop: space.sm }}>
        Photos are sent to Claude to be read and are not stored.
      </Caption>
    </Screen>
  );
}
