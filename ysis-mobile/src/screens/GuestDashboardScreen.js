import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { fetchAndCacheAllStudents } from '../services/studentSync';
import { useTheme } from '../theme/ThemeContext';

const schoolLogo = require('../../assets/yala-matrix-schools-logo.jpg');

function MenuCard({ icon, title, subtitle, onPress, colors }) {
  return <Pressable onPress={onPress} style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary || '#E8F0FF' }]}><Ionicons name={icon} size={35} color={colors.brand} /></View>
    <View style={{ flex: 1 }}><Text style={[styles.menuTitle, { color: colors.textPrimary }]}>{title}</Text><Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>{subtitle}</Text></View>
    <Ionicons name="chevron-forward" size={23} color={colors.brand} />
  </Pressable>;
}

export default function GuestDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [studentCount, setStudentCount] = useState(null);
  const [connection, setConnection] = useState('Checking');
  const [lastSync, setLastSync] = useState('Not synced yet');
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        await fetchAndCacheAllStudents({ force: true });
        const data = await api.get('/students?page=1');
        if (active) {
          setStudentCount(Number(data.total || 0));
          setConnection('Online');
          setLastSync('Just now');
        }
      } catch {
        if (active) setConnection('Offline');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []));

  const expiry = user?.guestExpiresAt ? new Date(user.guestExpiresAt).toLocaleDateString() : 'See account details';
  return <ScrollView style={[styles.page, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    <View style={styles.brandHeader}>
      <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
      <View style={{ flex: 1 }}><Text style={styles.brandTitle}>YALAMATRIX SIS</Text><Text style={styles.brandSubtitle}>Student Information System</Text></View>
      <Pressable onPress={() => navigation.getParent()?.navigate('MoreTab')} accessibilityRole="button" accessibilityLabel="More options"><Ionicons name="settings-sharp" size={25} color="#FFFFFF" /></Pressable>
    </View>
    <View style={[styles.welcome, { backgroundColor: colors.surfaceSecondary || '#DCE9FF' }]}>
      <View style={{ flex: 1 }}><Text style={[styles.welcomeLabel, { color: colors.brand }]}>Welcome,</Text><Text style={[styles.guestName, { color: '#101C30' }]} numberOfLines={2}>{user?.fullName || user?.full_name || 'Guest'}</Text></View>
      <View style={[styles.guestAvatar, { backgroundColor: colors.brand }]}><Ionicons name="person" size={35} color="#FFFFFF" /><Text style={styles.guestBadge}>GUEST</Text></View>
    </View>
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="people" size={25} color={colors.brand} /><Text style={[styles.statValue, { color: colors.textPrimary }]}>{loading ? '…' : studentCount ?? '—'}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Assigned Students</Text></View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="calendar-outline" size={25} color={colors.brand} /><Text style={[styles.expiryValue, { color: colors.textPrimary }]}>{expiry}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Access Expires</Text></View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="wifi" size={25} color={connection === 'Online' ? colors.success : colors.warning} /><Text style={[styles.statValue, { color: connection === 'Online' ? colors.success : colors.textPrimary }]}>{connection}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Connection Status</Text></View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="sync" size={25} color={colors.brand} /><Text style={[styles.statValue, { color: colors.textPrimary }]}>{lastSync}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Last Sync</Text></View>
    </View>
    <View style={styles.menuList}>
      <MenuCard icon="people" title="Students" subtitle="View your assigned students and their details." colors={colors} onPress={() => navigation.navigate('GuestStudents')} />
      <MenuCard icon="globe-outline" title="Website" subtitle="Open the official Yalamatrix Schools website." colors={colors} onPress={() => navigation.getParent()?.navigate('WebsiteTab')} />
      <MenuCard icon="grid" title="More" subtitle="Profile, help and account options." colors={colors} onPress={() => navigation.getParent()?.navigate('MoreTab')} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { paddingBottom: 28 }, brandHeader: { backgroundColor: '#0752B8', paddingHorizontal: 18, paddingTop: 44, paddingBottom: 30, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, flexDirection: 'row', alignItems: 'center', gap: 12 }, logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF' }, brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.4 }, brandSubtitle: { color: '#FFFFFF', fontSize: 12, marginTop: 3 }, welcome: { marginHorizontal: 16, marginTop: 16, padding: 17, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }, welcomeLabel: { fontSize: 19, fontWeight: '700' }, guestName: { fontSize: 25, fontWeight: '900', marginTop: 2 }, accessText: { fontSize: 12, fontStyle: 'italic', marginTop: 6 }, guestAvatar: { width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' }, guestBadge: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', marginTop: -2 }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginTop: 14 }, statCard: { width: '48%', flexGrow: 1, minHeight: 112, borderWidth: 1, borderRadius: 17, padding: 13, alignItems: 'center', justifyContent: 'center' }, statValue: { fontSize: 21, fontWeight: '900', marginTop: 4 }, expiryValue: { fontSize: 15, fontWeight: '900', marginTop: 8 }, statLabel: { fontSize: 11, fontWeight: '600', marginTop: 3, textAlign: 'center' }, menuList: { paddingHorizontal: 16, gap: 10, marginTop: 18 }, menuCard: { minHeight: 104, borderWidth: 1, borderRadius: 22, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 14 }, menuIcon: { width: 76, height: 76, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, menuTitle: { fontSize: 20, fontWeight: '900' }, menuSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
});
