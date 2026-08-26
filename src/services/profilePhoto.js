import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const keyFor = (userId) => `ysis_profile_photo_${userId || 'default'}`;

export async function getStoredProfilePhotoUri(userId) {
  const id = userId || 'default';
  try {
    const uri = await SecureStore.getItemAsync(keyFor(id));
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch {
    return null;
  }
}

export async function saveProfilePhoto(userId, sourceUri) {
  if (!sourceUri) {
    throw new Error('Missing image.');
  }

  const id = String(userId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');

  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Storage is not available on this device.');
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 400 } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!manipulated.base64) {
    throw new Error('Could not process the image.');
  }

  const dest = baseDir + 'profile_' + id + '.jpg';

  try {
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
  } catch {}

  await FileSystem.writeAsStringAsync(dest, manipulated.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await SecureStore.setItemAsync(keyFor(id), dest);
  return dest;
}

export async function clearStoredProfilePhoto(userId) {
  const id = userId || 'default';
  try {
    const uri = await SecureStore.getItemAsync(keyFor(id));
    if (uri) {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    }
    await SecureStore.deleteItemAsync(keyFor(id));
  } catch {}
}
