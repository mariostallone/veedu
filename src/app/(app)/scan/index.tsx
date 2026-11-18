import { router, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Caption, Card, Row, Screen } from '@/components/ui';

/** Where the Pantry "Scan" button lands: pick label photo or barcode. */
export default function ScanChooser() {
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Scan' }} />
      <Card>
        <Row
          title="Scan a label"
          subtitle="Photograph a product to read its name, size and expiry date"
          onPress={() => router.push('/scan/label')}
        />
        <Row
          title="Scan a barcode"
          subtitle={Platform.OS === 'web' ? 'Type a barcode number (camera scanning needs the phone app)' : 'Look the product up, or open the item that has this barcode'}
          onPress={() => router.push('/scan/barcode')}
          last
        />
      </Card>
      <Caption>Every scan shows what was found for you to check before anything is saved.</Caption>
    </Screen>
  );
}
