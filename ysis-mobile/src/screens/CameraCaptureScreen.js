import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveStudentPhoto } from '../services/photoUpload';

/**
 * Camera for a student's passport photo. Reached from StudentDetailScreen,
 * either for a first capture or for a principal's correction.
 * route.params: studentId, isCorrection, correctionReason (passed through unchanged).
 */
export default function CameraCaptureScreen({ route, navigation }) {
  const { studentId, isCorrection = false, correctionReason = null } = route.params;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const cameraRef = useRef(null);

  const saveAndClose = async (rawUri) => {
    await saveStudentPhoto({ studentId, rawUri, isCorrection, correctionReason });
    navigation.goBack();
  };

  const handleCapture = async () => {
    if (!cameraRef.current || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      await saveAndClose(photo.uri);
    } catch (err) {
      Alert.alert('Could not save photo', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGallery = async () => {
    if (saving) return;
    try {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert('Permission needed', 'Photo library access is needed to choose a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setSaving(true);
      await saveAndClose(result.assets[0].uri);
    } catch (err) {
      Alert.alert('Could not save photo', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.roundBtn, styles.permissionClose]}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.permissionText}>Camera access is needed to take a passport photo.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />

      <View style={styles.faceGuide} pointerEvents="none" />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close camera"
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Pressable
          style={styles.roundBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          accessibilityLabel="Flash"
        >
          <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.hint}>Center the student's face in the frame</Text>
        <View style={styles.shutterRow}>
          <Pressable
            style={styles.roundBtn}
            onPress={handleGallery}
            disabled={saving}
            accessibilityLabel="Choose from gallery"
          >
            <Ionicons name="images-outline" size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={styles.shutterOuter}
            onPress={handleCapture}
            disabled={saving}
            accessibilityLabel="Take photo"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <View style={styles.shutterInner} />}
          </Pressable>

          <Pressable
            style={styles.roundBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            disabled={saving}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionClose: { position: 'absolute', top: 56, left: 16 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 18 },
  button: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  buttonText: { color: '#101C30', fontWeight: '700', fontSize: 15 },

  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  faceGuide: {
    position: 'absolute',
    top: '20%',
    left: '50%',
    marginLeft: -115,
    width: 230,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 16,
  },
  hint: { color: '#fff', fontSize: 13, marginBottom: 20, opacity: 0.85 },
  shutterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
});
