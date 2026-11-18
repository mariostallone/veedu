import * as ImagePicker from 'expo-image-picker';

export type Photo = { uri: string; base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };

/** The Edge Function rejects images over 5 MB (decoded). */
const MAX_BYTES = 5 * 1024 * 1024;

/** Takes a photo with the camera or picks one from the library; null if the person cancels. Works on web too. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<Photo | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is off. Allow it in Settings, or choose a photo instead.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', base64: true, quality: 0.5, exif: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) throw new Error('Could not read that photo. Try another one.');
  if ((asset.base64.length * 3) / 4 > MAX_BYTES) throw new Error('That photo is too large. Try a smaller one.');
  const type = asset.mimeType;
  const mediaType = type === 'image/png' || type === 'image/webp' ? type : 'image/jpeg';
  return { uri: asset.uri, base64: asset.base64, mediaType };
}
