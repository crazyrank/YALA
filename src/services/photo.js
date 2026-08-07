import * as ImageManipulator from 'expo-image-manipulator';
import { PHOTO_TARGET_WIDTH, PHOTO_TARGET_HEIGHT, PHOTO_JPEG_QUALITY } from '../config';

/**
 * Compresses IMMEDIATELY at capture, not at sync time (Build Spec
 * Section 7 — locked decision). Tuned for mid-range Android performance:
 * 400x400px keeps thumbnail-list rendering smooth even with hundreds of
 * students on one device, and targets roughly 30-60KB per photo.
 */
export async function compressPassportPhoto(rawUri) {
  const result = await ImageManipulator.manipulateAsync(
    rawUri,
    [{ resize: { width: PHOTO_TARGET_WIDTH, height: PHOTO_TARGET_HEIGHT } }],
    { compress: PHOTO_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
