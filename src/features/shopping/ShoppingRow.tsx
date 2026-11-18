import { Text, View } from 'react-native';

import { Avatar, Caption, Checkbox, Chip, Row } from '@/components/ui';
import { useToggleListItem } from '@/features/lists/api';
import type { ListItem, Member } from '@/lib/types';
import { space, type, useColors } from '@/theme';

/** One shopping list line: checkbox, name × qty, note, "auto" / "restocks pantry" hints, and who added it. */
export function ShoppingRow({
  item,
  adder,
  last,
  onPress,
}: {
  item: ListItem;
  adder: Member | undefined;
  last: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const toggle = useToggleListItem();
  const title = item.qty === 1 ? item.text : `${item.text} × ${Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(1)}`;
  const hasMeta = !!item.note || item.source === 'pantry' || !!item.pantry_item_id;

  return (
    <Row
      title={title}
      muted={item.done}
      last={last}
      onPress={onPress}
      left={
        <Checkbox
          checked={item.done}
          label={`${item.done ? 'Uncheck' : 'Check off'} ${item.text}`}
          onChange={(done) => toggle.mutate({ item, done })}
        />
      }
      subtitle={
        hasMeta ? (
          <View style={{ gap: space.xs, paddingTop: 2 }}>
            {item.note ? <Caption>{item.note}</Caption> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
              {item.source === 'pantry' ? <Chip label="auto" tone="accent" /> : null}
              {item.pantry_item_id ? (
                <Text style={[type.caption, { color: c.textMuted }]}>restocks pantry</Text>
              ) : null}
            </View>
          </View>
        ) : undefined
      }
      right={adder ? <Avatar name={adder.display_name} color={adder.color} /> : undefined}
    />
  );
}
