import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import DashboardStatCard from './DashboardStatCard';
import { getDb } from '../db';
import { api } from '../api/client';
import { fetchAndCacheAllStudents, getLocalStudentCount } from '../services/studentSync';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';

const PAGE_SIZE = 30;

export default function DashboardStudentSyncCards() {
  const { colors } = useTheme();

  const [totalStudents, setTotalStudents] = useState(null);
  const [syncedStudents, setSyncedStudents] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStudentCounts = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const db = await getDb();

      // Local synced count (always available offline)
      const localResult = await db.getFirstAsync(`
        SELECT COUNT(*) AS count
        FROM students s
        WHERE s.local_dirty = 0
          AND NOT EXISTS (
            SELECT 1
            FROM sync_operations so
            WHERE so.entity_id = s.id
              AND so.status IN ('pending', 'conflicted', 'failed')
          )
      `);
      setSyncedStudents(Number(localResult?.count || 0));

      // Prefer server total; fall back to local total on any network/auth error
      try {
        const { total } = await fetchAndCacheAllStudents({ force: false });
        setTotalStudents(total);
      } catch (netErr) {
        const localTotal = await getLocalStudentCount();
        setTotalStudents(localTotal);
        // Only log if it is not a plain network/offline case
        if (!netErr?.isNetworkError) {
          console.warn('Dashboard student count unavailable:', netErr?.message || netErr);
        }
      }
    } catch (error) {
      console.warn('Dashboard student count unavailable:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      loadStudentCounts();
    }, [loadStudentCounts])
  );

  return (
    <>
      <DashboardStatCard
        icon="people-circle"
        value={
          totalStudents === null
            ? '—'
            : totalStudents
        }
        title="Total Students"
        subtitle="In database"
        color={colors.ink}
        bg={colors.surface}
        delay={200}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.success,
            },
          ]}
        >
          <Ionicons
            name="cloud-done"
            size={19}
            color="#FFFFFF"
          />
        </View>

        <Text
          style={[
            styles.value,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          {syncedStudents === null
            ? '—'
            : syncedStudents}
        </Text>

        <Text
          style={[
            styles.title,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          Synced to Database
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textMuted,
            },
          ]}
        >
          {syncedStudents === null
            ? 'Checking sync status'
            : 'Records fully synchronized'}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 118,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  value: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
  },

  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
