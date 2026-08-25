import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveStudentPhoto } from '../services/photoUpload';

/**
 * Live camera view for capturing a student's passport photo. Reached
 * either from a normal first-time capture (StudentDetailScreen) or from
 * the Principal's correction flow — `route.params.isCorrection` and
 * `correctionReason` are passed through to the upload service unchanged.
 */
export default function CameraCaptureScreen({ route, navigation }) {
  const { studentId, isCorrection = false, correctionReason = null } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera access is needed to take a passport photo.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      await saveStudentPhoto({ studentId, rawUri: photo.uri, isCorrection, correctionReason });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save photo', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <Text style={styles.hint}>Center the student's face in frame</Text>
        <Pressable style={styles.captureButton} onPress={handleCapture} disabled={saving}>
          {saving ? <ActivityIndicator color="#0d1f33" /> : <View style={styles.captureInner} />}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, backgroundColor: '#0d1f33', justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  controls: { padding: 20, backgroundColor: '#0d1f33', alignItems: 'center' },
  hint: { color: '#cfd9e4', fontSize: 12, marginBottom: 14 },
  captureButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#c9a24b',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  cancelButton: { padding: 8 },
  cancelText: { color: '#a9b8c8', fontSize: 13 },
  button: { backgroundColor: '#c9a24b', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#0d1f33', fontWeight: '700', fontSize: 14 },
});
