import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

const SECTION_LABEL = {
  board: 'Board of Directors',
  management: 'Management Team',
  class_teacher: 'Class Teachers',
};

/**
 * Create or edit a display-only directory card. Reached only for cards a
 * Director/Principal/Head Teacher is allowed to create or edit for this
 * section (StaffDirectoryScreen already gates entry) — the server checks
 * the same rule again, so this screen doesn't need to duplicate it.
 */
export default function AddDirectoryEntryScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { section, entry } = route.params || {};
  const isEditing = !!entry;

  const [fullName, setFullName] = useState(entry?.fullName || '');
  const [title, setTitle] = useState(entry?.title || '');
  const [photoUri, setPhotoUri] = useState(entry?.photoUrl || null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to choose a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 300 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    setPhotoUri(manipulated.uri);
    setPhotoBase64(manipulated.base64);
  };

  const handleSave = async () => {
    if (!fullName.trim() || !title.trim()) {
      Alert.alert('Missing details', 'Full name and office/title are required.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.patch(`/directory/${entry.id}`, {
          fullName: fullName.trim(),
          title: title.trim(),
          ...(photoBase64 ? { photoBase64 } : {}),
        });
      } else {
        await api.post('/directory', {
          section,
          fullName: fullName.trim(),
          title: title.trim(),
          ...(photoBase64 ? { photoBase64 } : {}),
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove from directory?', `${entry.fullName} will be removed from the staff slide.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await api.delete(`/directory/${entry.id}`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not remove', err.message || 'Something went wrong.');
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>{SECTION_LABEL[section] || 'Staff Directory'}</Text>
      <Text style={styles.hint}>
        Name, office/title, and a picture — this is a yearbook-style card, not a login account.
      </Text>

      <Pressable style={styles.photoPicker} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={22} color={colors.textMuted} />
          </View>
        )}
        <Text style={styles.photoPickerText}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
      </Pressable>

      <Field label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="Full name" colors={colors} />
      <Field
        label="Office / Title *"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Chairman, Class Teacher – JSS1"
        colors={colors}
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>{isEditing ? 'Save Changes' : 'Add to Directory'}</Text>}
      </Pressable>

      {isEditing && (
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
          <Text style={styles.deleteButtonText}>Remove from Directory</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Field({ label, colors, ...props }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} {...props} />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    sectionLabel: { ...type.overline, color: colors.goldDark, marginBottom: spacing.xs },
    hint: { ...type.bodySmall, color: colors.textMuted, marginBottom: spacing.lg },

    photoPicker: {
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    photo: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.border,
    },
    photoPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPickerText: {
      ...type.label,
      fontSize: 11,
      color: colors.goldDark,
      marginTop: spacing.xs,
    },

    fieldGroup: { marginBottom: spacing.md },
    label: { ...type.label, color: colors.textPrimary, marginBottom: spacing.xs },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      ...type.body,
      fontSize: 14,
    },

    button: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md + 2,
      borderRadius: radius.md,
      marginTop: spacing.md,
      alignItems: 'center',
      ...shadow.goldGlow,
    },
    buttonText: { ...type.button, color: colors.ink },

    deleteButton: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    deleteButtonText: { ...type.bodyMedium, fontSize: 13, color: colors.error },
  });
}
