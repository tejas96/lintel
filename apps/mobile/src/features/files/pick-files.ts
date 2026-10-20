import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { LocalFile } from '@/api/file-transfer';

export type FileSource = 'camera' | 'library' | 'document';

export type PickResult =
  | { readonly outcome: 'picked'; readonly files: readonly LocalFile[] }
  | { readonly outcome: 'cancelled' }
  | { readonly outcome: 'denied'; readonly message: string };

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

function fromImageAsset(asset: ImagePicker.ImagePickerAsset, index: number): LocalFile {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return {
    uri: asset.uri,
    mimeType,
    name: asset.fileName ?? `photo-${Date.now()}-${index}.${extensionFor(mimeType)}`,
  };
}

/**
 * Camera, photo library or Files. The library and Files use the system
 * pickers, which need no permission; the camera asks the first time.
 */
export async function pickFiles(
  source: FileSource,
  options: { readonly multiple?: boolean; readonly limit?: number } = {},
): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        outcome: 'denied',
        message: 'Camera access is off. Turn it on for Lintel in Settings to take photos.',
      };
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return { outcome: 'cancelled' };
    return { outcome: 'picked', files: result.assets.map(fromImageAsset) };
  }
  if (source === 'library') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: options.multiple ?? false,
      selectionLimit: options.limit ?? 1,
    });
    if (result.canceled) return { outcome: 'cancelled' };
    return { outcome: 'picked', files: result.assets.map(fromImageAsset) };
  }
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: options.multiple ?? false,
  });
  if (result.canceled) return { outcome: 'cancelled' };
  return {
    outcome: 'picked',
    files: result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    })),
  };
}
