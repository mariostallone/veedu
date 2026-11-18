import { View } from 'react-native';
import { router } from 'expo-router';

import { Caption, Chip, ProgressBar, Row, Stepper } from '@/components/ui';
import { expiryLabel, expiryStatus, formatQty, isLow, stockLevel } from '@/lib/domain';
import type { PantryItem } from '@/lib/types';
import { space } from '@/theme';

/** One pantry item: name, stock, keep-at-least, progress bar, expiry chip and a +/- stepper. */
export function PantryRow({
  item,
  today,
  onAdjust,
  last,
}: {
  item: PantryItem;
  today: string;
  onAdjust: (id: string, delta: number) => void;
  last?: boolean;
}) {
  const low = isLow(item);
  const status = expiryStatus(item.expires_on, today);
  const label = expiryLabel(status);
  const details = [
    formatQty(item.qty, item.unit),
    item.keep_min > 0 ? `keep at least ${formatQty(item.keep_min, item.unit)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Row
      title={item.name}
      last={last}
      onPress={() => router.push(`/pantry/${item.id}`)}
      subtitle={
        <View style={{ gap: space.xs, paddingTop: 2 }}>
          <Caption>{details}</Caption>
          {item.keep_min > 0 ? <ProgressBar value={stockLevel(item.qty, item.keep_min)} danger={low} /> : null}
          {low || label ? (
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              {low ? <Chip label="Low" tone="danger" /> : null}
              {label ? <Chip label={label} tone={status.kind === 'expired' ? 'danger' : 'warn'} /> : null}
            </View>
          ) : null}
        </View>
      }
      right={<Stepper value={item.qty} label={item.name} onChange={(delta) => onAdjust(item.id, delta)} />}
    />
  );
}
