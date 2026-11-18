import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { usePantry, useUpdatePantryItem } from '@/features/pantry/api';
import { fetchOpenFoodFacts } from '@/features/scan/api';
import {
  barcodeToPrefill,
  filterPantry,
  findByBarcode,
  formatQty,
  normaliseBarcode,
  parseOpenFoodFacts,
  type ProductInfo,
} from '@/lib/domain';
import type { PantryItem } from '@/lib/types';
import { radius, space, useColors } from '@/theme';

type Found = { code: string; product: ProductInfo | null; unreachable: boolean };

/**
 * Scan (or type) a barcode. A code the pantry already remembers opens that item; otherwise
 * Open Food Facts fills in a new item, or the code can be attached to an existing item.
 */
export default function ScanBarcode() {
  const c = useColors();
  const pantry = usePantry();
  const update = useUpdatePantryItem();
  const [permission, requestPermission] = useCameraPermissions();
  const busy = useRef(false);
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PantryItem | null>(null);

  if (pantry.isPending) return <Loading />;
  const items = pantry.data ?? [];
  const cameraSupported = Platform.OS !== 'web';

  async function handleCode(raw: string) {
    const code = normaliseBarcode(raw);
    if (!code) {
      setTypedError('That does not look like a product barcode (8 to 14 digits).');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setTypedError(null);
    const known = findByBarcode(items, code);
    if (known) {
      router.replace({ pathname: '/pantry/[id]', params: { id: known.id } });
      return;
    }
    setLooking(true);
    const res = await fetchOpenFoodFacts(code);
    setLooking(false);
    setFound({
      code,
      product: 'json' in res ? parseOpenFoodFacts(res.json) : null,
      unreachable: 'unreachable' in res,
    });
  }

  function reset() {
    busy.current = false;
    setFound(null);
    setAttaching(false);
    setTarget(null);
    setQuery('');
  }

  const header = <Stack.Screen options={{ title: 'Scan barcode' }} />;

  if (looking) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <Loading />
        <Body muted style={{ textAlign: 'center' }}>Looking it up…</Body>
      </Screen>
    );
  }

  if (found) {
    const { code, product, unreachable } = found;
    const matches = filterPantry(items, query).slice(0, 8);
    return (
      <Screen edges={['bottom']}>
        {header}
        <SectionLabel>Barcode {code}</SectionLabel>
        <Card style={{ paddingVertical: space.md, gap: space.xs }}>
          {product ? (
            <>
              <Body style={{ fontWeight: '700' }}>{product.name}</Body>
              <Caption>
                {[product.size !== null ? `${product.size} ${product.unit}` : null, 'from Open Food Facts']
                  .filter(Boolean)
                  .join(' · ')}
              </Caption>
            </>
          ) : (
            <Body muted>
              {unreachable
                ? 'Could not reach Open Food Facts. You can still save the barcode.'
                : 'This product is not in Open Food Facts. You can still save the barcode.'}
            </Body>
          )}
        </Card>
        <Caption>Nothing is saved until you finish the next step.</Caption>

        {attaching ? (
          <>
            <SectionLabel>Which pantry item is this?</SectionLabel>
            <Field value={query} onChangeText={setQuery} placeholder="Search pantry" accessibilityLabel="Search pantry" autoCapitalize="none" />
            <Card>
              {matches.map((item, i) => (
                <Row
                  key={item.id}
                  title={item.name}
                  subtitle={item.barcode ? 'Already has a barcode' : formatQty(item.qty, item.unit)}
                  last={i === matches.length - 1}
                  onPress={() => setTarget(item)}
                  titleStyle={target?.id === item.id ? { color: c.accent } : undefined}
                />
              ))}
            </Card>
            <ErrorNote error={update.error} />
            <Button
              label={target ? `Remember barcode for ${target.name}` : 'Pick an item'}
              disabled={!target}
              loading={update.isPending}
              onPress={() =>
                target &&
                update.mutate(
                  { id: target.id, barcode: code },
                  { onSuccess: () => router.replace({ pathname: '/pantry/[id]', params: { id: target.id } }) },
                )
              }
            />
            <Button label="Back" variant="secondary" onPress={() => setAttaching(false)} />
          </>
        ) : (
          <>
            <Button
              label={product ? 'Add as new pantry item' : 'Add new pantry item with this barcode'}
              onPress={() =>
                router.replace({ pathname: '/pantry/[id]', params: { id: 'new', ...barcodeToPrefill(code, product) } })
              }
            />
            {items.length > 0 ? (
              <Button label="Attach to an existing item" variant="secondary" onPress={() => setAttaching(true)} />
            ) : null}
            <Button label="Scan another" variant="secondary" onPress={reset} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {header}
      {!cameraSupported ? (
        <EmptyState
          title="Camera scanning needs the phone app"
          message="Barcode scanning is not available in the browser. Type the number printed under the barcode instead."
        />
      ) : permission === null ? (
        <Loading />
      ) : !permission.granted ? (
        <Card style={{ paddingVertical: space.lg, gap: space.md }}>
          <Body>Allow camera access to scan barcodes.</Body>
          <Button label="Allow camera" onPress={() => requestPermission()} />
        </Card>
      ) : (
        <View style={{ height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.border }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => handleCode(data)}
          />
        </View>
      )}
      <SectionLabel>Or type the number</SectionLabel>
      <Card style={{ paddingVertical: space.md, gap: space.md }}>
        <Field
          value={typed}
          onChangeText={setTyped}
          placeholder="e.g. 8901234567890"
          keyboardType="number-pad"
          accessibilityLabel="Barcode number"
          error={typedError}
          onSubmitEditing={() => handleCode(typed)}
        />
        <Button label="Look up" variant="secondary" disabled={!typed.trim()} onPress={() => handleCode(typed)} />
      </Card>
    </Screen>
  );
}
