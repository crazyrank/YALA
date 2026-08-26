import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius, shadow } from '../theme/spacing';

function MenuRow({ icon, label, subtitle, color, onPress, danger }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: danger ? colors.errorBg : color + '18' },
        ]}
      >
        <Ionicons name={icon} size={20} color={danger ? colors.error : color} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowLabel,
            { color: danger ? colors.error : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
        {!!subtitle && (
          <Text style={[styles.rowSub, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `\( {parts[0][0]} \){parts[parts.length - 1][0]}`.toUpperCase();
}

export default function MoreScreen({ navigation }) {
  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors } = useTheme();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const pickAndSave = async (fromCamera) => {
    try {
      if (fromCamera) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert(
            'Permission needed',
            'Camera access is required to take a profile photo.'
          );
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          Alert.alert(
            'Permission needed',
            'Photo library access is required to choose a profile picture.'
          );
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      await updateProfilePhoto(result.assets[0].uri);
      Alert.alert(
        'Profile updated',
        'Your profile picture has been saved on this device.'
      );
    } catch (err) {
      Alert.alert(
        'Could not update photo',
        err.message || 'Something went wrong.'
      );
    } finally {
      setUploading(false);
    }
  };

  const openChangeMenu = () => {
    Alert.alert('Change profile picture', 'Choose a source', [
      { text: 'Take photo', onPress: () => pickAndSave(true) },
      { text: 'Choose from library', onPress: () => pickAndSave(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAvatarPress = () => {
    const hasPhoto = !!(user?.photo_url || user?.avatar_url);
    if (!hasPhoto) {
      openChangeMenu();
      return;
    }
    Alert.alert('Profile picture', undefined, [
      { text: 'View photo', onPress: () => setViewerOpen(true) },
      { text: 'Change photo', onPress: openChangeMenu },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeProfilePhoto();
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not remove photo.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleChangePhoto = () => {
    const hasPhoto = !!(user?.photo_url || user?.avatar_url);
    if (hasPhoto) {
      handleAvatarPress();
    } else {
      openChangeMenu();
    }
  };

  const photoUri = user?.photo_url || user?.avatar_url || null;

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.profile,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            onPress={handleAvatarPress}
            disabled={uploading}
            style={styles.avatarWrap}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.ink }]}>
                <Text style={styles.avatarText}>
                  {getInitials(user?.full_name || user?.email || 'U')}
                </Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.gold }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#0A1930" />
              ) : (
                <Ionicons name="camera" size={14} color="#0A1930" />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.name, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {user?.full_name || 'Staff'}
            </Text>
            <Text style={[styles.role, { color: colors.goldDark }]}>
              {(user?.role || 'staff').replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              Tap photo to view or change
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>PROFILE</Text>

        <MenuRow
          icon="camera"
          label="Change profile picture"
          subtitle="Upload, view, or remove your photo"
          color={colors.inkSoft}
          onPress={handleChangePhoto}
        />

        <Text style={[styles.section, { color: colors.textMuted }]}>MANAGE</Text>

        {isAdmin && (
          <MenuRow
            icon="people"
            label="Manage Staff"
            subtitle="Create and manage accounts"
            color={colors.inkSoft}
            onPress={() => navigation.navigate('ManageStaff')}
          />
        )}

        {isAdmin && (
          <MenuRow
            icon="warning"
            label="Conflicts"
            subtitle="Resolve sync conflicts"
            color={colors.warning}
            onPress={() => navigation.navigate('Conflicts')}
          />
        )}

        {isAdmin && (
          <MenuRow
            icon="git-merge"
            label="Duplicate Registrations"
            subtitle="Merge queue"
            color="#5B3A8E"
            onPress={() => navigation.navigate('MergeQueue')}
          />
        )}

        <MenuRow
          icon="person-add"
          label="Register Student"
          subtitle="Add a new student record"
          color={colors.inkSoft}
          onPress={() => navigation.navigate('RegisterTab')}
        />

        <Text
          style={[styles.section, { color: colors.textMuted, marginTop: 18 }]}
        >
          ACCOUNT
        </Text>

        <MenuRow
          icon="log-out-outline"
          label="Sign out"
          subtitle="End this session"
          color={colors.error}
          danger
          onPress={confirmLogout}
        />
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.viewerActions}>
            <Pressable
              style={styles.viewerBtn}
              onPress={() => {
                setViewerOpen(false);
                openChangeMenu();
              }}
            >
              <Text style={styles.viewerBtnText}>Change</Text>
            </Pressable>
            <Pressable
              style={[styles.viewerBtn, styles.viewerBtnGhost]}
              onPress={() => setViewerOpen(false)}
            >
              <Text style={styles.viewerBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    ...shadow.raised,
  },
  avatarWrap: {
    marginRight: 14,
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E4E8EF',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.display,
    fontSize: 20,
  },
  name: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
  },
  role: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  tapHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadow.raised,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 15,
  },
  rowSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,48,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
    backgroundColor: '#16324F',
  },
  viewerActions: {
    flexDirection: 'row',
    marginTop: 28,
  },
  viewerBtn: {
    backgroundColor: '#C9A24B',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  viewerBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
  },
});
