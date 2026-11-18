import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { useMemberMap } from '@/features/household/api';
import { useAddListItem, useClearDone, useListItems, useSingletonList } from '@/features/lists/api';
import { ShoppingRow } from '@/features/shopping/ShoppingRow';
import { findDuplicateItem, groupShopping, parseQuickAdd, storeOptions } from '@/lib/domain';
import { useHousehold } from '@/lib/session';
import { radius, space, useColors } from '@/theme';

export default function ShoppingTab() {
  const c = useColors();
  const { household } = useHousehold();
  const list = useSingletonList('shopping');
  const items = useListItems(list.data?.id);
  const members = useMemberMap();
  const add = useAddListItem();
  const clear = useClearDone();
  const [text, setText] = useState('');
  const [store, setStore] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  if (list.isPending || (list.data && items.isPending)) return <Loading />;
  if (!list.data) {
    return (
      <Screen title="Shopping">
        <ErrorNote error={list.error} />
        <EmptyState title="No shopping list yet" message={`Your ${household.name} shopping list could not be found.`} />
      </Screen>
    );
  }

  const listId = list.data.id;
  const all = items.data ?? [];
  const { toBuy, inCart } = groupShopping(all);
  const stores = storeOptions(all);

  function submit(force: boolean) {
    const parsed = parseQuickAdd(text);
    if (!parsed.text) return;
    if (!force && findDuplicateItem(all, parsed.text)) {
      setDuplicate(parsed.text);
      return;
    }
    setDuplicate(null);
    add.mutate({ list_id: listId, text: parsed.text, qty: parsed.qty, group_name: store });
    setText('');
  }

  return (
    <Screen title="Shopping" subtitle={`${toBuy.reduce((n, g) => n + g.items.length, 0)} to buy`}>
      <Card style={{ paddingVertical: space.md, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              value={text}
              onChangeText={(t) => {
                setText(t);
                setDuplicate(null);
              }}
              onSubmitEditing={() => submit(false)}
              placeholder='Add an item, e.g. "milk x2"'
              accessibilityLabel="New shopping item"
              returnKeyType="done"
              blurOnSubmit={false}
            />
          </View>
          <Button label="Add" onPress={() => submit(false)} disabled={!text.trim()} loading={add.isPending} />
        </View>
        <ChoiceChips options={stores} value={store} onChange={setStore} />
        {duplicate ? (
          <View style={{ backgroundColor: c.warnSoft, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
            <Body style={{ color: c.warn }}>{`"${duplicate}" is already on the list.`}</Body>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Add anyway" variant="secondary" onPress={() => submit(true)} style={{ flex: 1 }} />
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setDuplicate(null);
                  setText('');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}
        <ErrorNote error={add.error} />
      </Card>

      <ErrorNote error={items.error} />

      {all.length === 0 ? (
        <EmptyState title="Nothing to buy" message="Add what you need above. Low pantry items show up here by themselves." />
      ) : null}

      {toBuy.map((group) => (
        <View key={group.key} style={{ gap: space.sm }}>
          <SectionLabel>{group.key}</SectionLabel>
          <Card>
            {group.items.map((item, i) => (
              <ShoppingRow
                key={item.id}
                item={item}
                adder={item.created_by ? members.get(item.created_by) : undefined}
                last={i === group.items.length - 1}
                onPress={() => router.push(`/shop/${item.id}`)}
              />
            ))}
          </Card>
        </View>
      ))}

      {inCart.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel
            right={
              <Button
                label="Clear checked"
                variant="secondary"
                loading={clear.isPending}
                onPress={() => clear.mutate(listId)}
                style={{ minHeight: 34, paddingHorizontal: space.md }}
              />
            }>
            In the cart
          </SectionLabel>
          <Card>
            {inCart.map((item, i) => (
              <ShoppingRow
                key={item.id}
                item={item}
                adder={item.created_by ? members.get(item.created_by) : undefined}
                last={i === inCart.length - 1}
                onPress={() => router.push(`/shop/${item.id}`)}
              />
            ))}
          </Card>
          <Caption>Checked items that match a pantry item have already topped up its count.</Caption>
          <ErrorNote error={clear.error} />
        </View>
      ) : null}
    </Screen>
  );
}
