import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, ErrorNote } from '@/components/ui';
import { radius, space, useColors } from '@/theme';

import { pickPhoto, type Photo } from './photo';

/**
 * Camera / library buttons plus a preview of the last photo. Calls `onPhoto` with the picked image;
 * the screen decides what to do with it (nothing is uploaded or saved here).
 */
export function PhotoCapture({
  hint,
  photo,
  busy,
  onPhoto,
}: {
  hint: string;
  photo: Photo | null;
  busy?: boolean;
  onPhoto: (photo: Photo) => void;
}) {
  const c = useColors();
  const [error, setError] = useState<unknown>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    try {
      const picked = await pickPhoto(source);
      if (picked) onPhoto(picked);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Card style={{ paddingVertical: space.lg, gap: space.md }}>
      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          contentFit="contain"
          accessibilityLabel="Your photo"
          style={{ width: '100%', height: 220, borderRadius: radius.md, backgroundColor: c.border }}
        />
      ) : (
        <Body muted>{hint}</Body>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label={photo ? 'Retake' : 'Take photo'}
          onPress={() => pick('camera')}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <Button
          label="Choose photo"
          variant="secondary"
          onPress={() => pick('library')}
          disabled={busy}
          style={{ flex: 1 }}
        />
      </View>
      <ErrorNote error={error} />
    </Card>
  );
}
