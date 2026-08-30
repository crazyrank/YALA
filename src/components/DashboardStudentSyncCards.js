import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import DashboardStatCard from './DashboardStatCard';
import { getDb } from '../db';
import { api } from '../api/client';
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

      /*
       * LOCAL SYNC COUNT
       *
       * A student is considered synced when:
       * 1. The local student record is not dirty.
       * 2. There is no pending, conflicted, or failed sync operation
       *    belonging to that student.
       *
       * This uses the existing local sync architecture.
       */
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

      /*
       * SERVER COUNT
       *
       * Uses the EXISTING authenticated /students endpoint.
       * No new endpoint and no new security flow.
       *
       * The endpoint returns 30 students per page, so we continue
       * requesting pages until the final page is reached.
       */
      let page = 1;
      let serverCount = 0;

      while (true) {
        const response = await api.get(
          `/students?page=${page}`
        );

        const students = Array.isArray(response?.students)
          ? response.students
          : [];

        serverCount += students.length;

        if (students.length < PAGE_SIZE) {
          break;
        }

        page += 1;
      }

      setTotalStudents(serverCount);
    } catch (error) {
      /*
       * Do not interfere with the existing authentication/security flow.
       *
       * If the server cannot be reached, the existing local data remains
       * available and the server total is simply left unavailable.
       */
      console.warn(
        'Dashboard student count unavailable:',
        error?.message || error
      );
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
