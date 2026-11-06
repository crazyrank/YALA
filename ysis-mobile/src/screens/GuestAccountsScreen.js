import React, { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

// ----- Input cleaning -----

const pad = (n) => String(n).padStart(2, '0');

const collapse = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const cleanName = (v) => collapse(v).replace(/[^A-Za-z\u00C0-\u024F .'-]/g, '');

const cleanEmail = (v) => String(v ?? '').trim().toLowerCase();

const cleanPhone = (v) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  return (raw.startsWith('+') ? '+' : '') + raw.replace(/\D/g, '');
};

// Admission numbers look like YMS/2022/03/236, so "/" is kept.
const cleanSearch = (v) =>
  collapse(v).slice(0, 60).replace(/[^A-Za-z0-9 .'\-/\u00C0-\u024F]/g, '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ----- Dates: typed as DD/MM/YYYY, sent to the server as YYYY-MM-DD -----

// Adds slashes while typing. Digits only, 8 digits maximum.
const formatDMY = (text) => {
  const digits = String(text ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Default date, days from today, in DD/MM/YYYY.
const defaultDMY = (days = 30) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Returns { iso, error }. iso is YYYY-MM-DD when the date is real and in the future.
const parseDMY = (text) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text ?? '').trim());
  if (!m) return { iso: null, error: 'Enter the date as DD/MM/YYYY.' };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!real) return { iso: null, error: 'That date does not exist.' };
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  if (iso <= todayISO()) return { iso: null, error: 'The date must be in the future.' };
  return { iso, error: null };
};

// Turns YYYY-MM-DD into the end of that day, which the server expects.
const endOfDay = (iso) => new Date(`${iso}T23:59:59`).toISOString();

function Field({ label, value, onChangeText, ...props }) {
  const { colors } = useTheme();
  return <View style={{ marginBottom: 12 }}>
    <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholderTextColor={colors.textMuted}
      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]} {...props} />
  </View>;
}

export default function GuestAccountsScreen() {
  const { colors } = useTheme();
  const [guests, setGuests] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [expiryDMY, setExpiryDMY] = useState(() => defaultDMY(30));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [renewingId, setRenewingId] = useState(null);
  const [renewDMY, setRenewDMY] = useState(() => defaultDMY(30));
  const [renewReason, setRenewReason] = useState('');

  const loadGuests = useCallback(async () => {
    setLoading(true);
    try { const data = await api.get('/guest-accounts'); setGuests(data.guests || []); }
    catch (err) { Alert.alert('Could not load Guest accounts', err.message || 'Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadGuests(); }, [loadGuests]));

  const searchStudents = async () => {
    const q = cleanSearch(search);
    if (q.length < 2) return Alert.alert('Search students', 'Enter at least two characters.');
    try {
      const data = await api.get(`/students?search=${encodeURIComponent(q)}&page=1`);
      setStudents(data.students || []);
    } catch (err) { Alert.alert('Student search failed', err.message || 'Please try again.'); }
  };

  const toggleStudent = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length >= 100 ? current : [...current, id]);

  const createGuest = async () => {
    const name = cleanName(fullName);
    const mail = cleanEmail(email);
    const tel = cleanPhone(phone);
    const why = collapse(reason);
    const { iso, error } = parseDMY(expiryDMY);

    const problems = [];
    if (name.length < 3) problems.push('Enter the guest full name.');
    if (!EMAIL_RE.test(mail)) problems.push('Enter a valid email address.');
    const digits = tel.replace('+', '').length;
    if (tel && (digits < 7 || digits > 15)) problems.push('Phone should have 7 to 15 digits, or be left empty.');
    if (why.length < 8) problems.push('Give a clear reason for access (at least 8 characters).');
    if (error) problems.push(error);
    if (selected.length === 0) problems.push('Select at least one student.');
    if (problems.length) return Alert.alert('Check the form', problems[0]);

    setBusy(true);
    try {
      const data = await api.post('/guest-accounts', { fullName: name, email: mail, phone: tel || undefined, reason: why, expiresAt: endOfDay(iso), studentIds: selected });
      Alert.alert('Guest account approved', `Email: ${data.user.email}\nTemporary password: ${data.tempCredential}`, [
        { text: 'Copy password', onPress: () => Clipboard.setStringAsync(data.tempCredential) },
        { text: 'Done' },
      ]);
      setFullName(''); setEmail(''); setPhone(''); setReason(''); setSelected([]); setStudents([]); setSearch('');
      setExpiryDMY(defaultDMY(30));
      await loadGuests();
    } catch (err) { Alert.alert('Could not create Guest account', err.message || 'Please try again.'); }
    finally { setBusy(false); }
  };

  const renewGuest = async () => {
    const why = collapse(renewReason);
    const { iso, error } = parseDMY(renewDMY);
    if (!renewingId || error || why.length < 8) {
      return Alert.alert('Complete renewal details', error || 'Enter a reason of at least 8 characters.');
    }
    setBusy(true);
    try {
      await api.patch(`/guest-accounts/${renewingId}/renew`, { expiresAt: endOfDay(iso), reason: why });
      setRenewingId(null); setRenewReason(''); await loadGuests();
      Alert.alert('Access renewed', 'The Guest must sign in again because the previous session was invalidated.');
    } catch (err) { Alert.alert('Could not renew access', err.message || 'Please try again.'); }
    finally { setBusy(false); }
  };

  const changeStatus = (guest) => {
    const next = guest.status === 'active' ? 'suspended' : 'active';
    Alert.alert(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} Guest`, `${guest.fullName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: next === 'suspended' ? 'destructive' : 'default', onPress: async () => {
        try { await api.patch(`/guest-accounts/${guest.id}/status`, { status: next }); await loadGuests(); }
        catch (err) { Alert.alert('Action failed', err.message || 'Please try again.'); }
      } },
    ]);
  };

  return <ScrollView style={[styles.page, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={[styles.heading, { color: colors.textPrimary }]}>Guest Accounts</Text>
    <Text style={[styles.note, { color: colors.textMuted }]}>Only Directors and Principals can approve Guest access. Each account is audited, device-approved and expires automatically.</Text>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.subheading, { color: colors.textPrimary }]}>Approve a Guest</Text>
      <Field label="Full name *" value={fullName} onChangeText={setFullName} placeholder="Guest's full name" />
      <Field label="Email *" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
      <Field label="Reason for access *" value={reason} onChangeText={setReason} placeholder="Why is this person being granted access?" multiline />
      <Field label="Access expires (DD/MM/YYYY) *" value={expiryDMY} onChangeText={(t) => setExpiryDMY(formatDMY(t))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
      <Text style={[styles.label, { color: colors.textPrimary }]}>Assign students * ({selected.length} selected)</Text>
      <View style={styles.searchRow}>
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={searchStudents} returnKeyType="search"
          placeholder="Search by student name or admission no." placeholderTextColor={colors.textMuted}
          autoCorrect={false} style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border }]} />
        <Pressable onPress={searchStudents} style={[styles.searchButton, { backgroundColor: colors.brand }]}><Ionicons name="search" size={18} color="#FFFFFF" /></Pressable>
      </View>
      {students.map((student) => {
        const active = selected.includes(student.id);
        return <Pressable key={student.id} onPress={() => toggleStudent(student.id)} style={[styles.studentRow, { borderColor: colors.border, backgroundColor: active ? colors.surfaceSecondary : colors.surface }]}>
          <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={colors.brand} />
          <View style={{ flex: 1 }}><Text style={[styles.studentName, { color: colors.textPrimary }]}>{student.full_name}</Text><Text style={[styles.note, { color: colors.textMuted }]}>{student.admission_no} · {student.class_level}</Text></View>
        </Pressable>;
      })}
      <Pressable disabled={busy} onPress={createGuest} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Approve & Create Guest Account</Text>}
      </Pressable>
    </View>
    <View style={styles.listHeader}><Text style={[styles.subheading, { color: colors.textPrimary }]}>Created by you</Text><Pressable onPress={loadGuests}><Ionicons name="refresh" size={20} color={colors.brand} /></Pressable></View>
    {loading && <ActivityIndicator color={colors.brand} />}
    {!loading && guests.map((guest) => <View key={guest.id} style={[styles.guestRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}><Text style={[styles.studentName, { color: colors.textPrimary }]}>{guest.fullName}</Text><Text style={[styles.note, { color: colors.textMuted }]}>{guest.email} · {guest.studentCount} students</Text><Text style={[styles.note, { color: guest.expired ? colors.error : colors.textMuted }]}>Expires: {new Date(guest.expiresAt).toLocaleDateString()} · {guest.expired ? 'Expired' : guest.status}</Text></View>
      <View style={{ gap: 8, alignItems: 'flex-end' }}>
        <Pressable onPress={() => changeStatus(guest)}><Text style={{ color: colors.brand, fontWeight: '700' }}>{guest.status === 'active' ? 'Suspend' : 'Reactivate'}</Text></Pressable>
        <Pressable onPress={() => { setRenewingId(guest.id); setRenewDMY(defaultDMY(30)); setRenewReason(''); }}><Text style={{ color: colors.brand, fontWeight: '700' }}>Renew</Text></Pressable>
      </View>
    </View>)}
    {!!renewingId && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.subheading, { color: colors.textPrimary }]}>Renew Guest Access</Text>
      <Field label="New expiry (DD/MM/YYYY)" value={renewDMY} onChangeText={(t) => setRenewDMY(formatDMY(t))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
      <Field label="Renewal reason *" value={renewReason} onChangeText={setRenewReason} placeholder="Reason for extending access" multiline />
      <Pressable disabled={busy} onPress={renewGuest} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}><Text style={styles.primaryText}>{busy ? 'Saving…' : 'Confirm Renewal'}</Text></Pressable>
      <Pressable onPress={() => setRenewingId(null)} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>Cancel</Text></Pressable>
    </View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 40 }, heading: { fontSize: 22, fontWeight: '800', marginBottom: 6 }, subheading: { fontSize: 16, fontWeight: '800' }, note: { fontSize: 12, lineHeight: 18, marginBottom: 12 }, card: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 8 }, label: { fontSize: 12, fontWeight: '700', marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 }, searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 }, searchInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 }, searchButton: { width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, studentRow: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 }, studentName: { fontSize: 14, fontWeight: '700' }, primaryButton: { marginTop: 16, borderRadius: 12, padding: 14, alignItems: 'center' }, primaryText: { color: '#FFFFFF', fontWeight: '800' }, listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 }, guestRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
});
