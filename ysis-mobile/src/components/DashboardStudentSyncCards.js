import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import DashboardStatCard from './DashboardStatCard';
import { getDb } from '../db';
import { fetchAndCacheAllStudents, getLocalStudentCount } from '../services/studentSync';
import { useTheme } from '../theme/ThemeContext';

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
        value={totalStudents === null ? '-' : totalStudents}
        title="Total Students"
        subtitle="In database"
        color={colors.textPrimary}
        bg={colors.surface}
        delay={200}
      />

      <DashboardStatCard
        icon="cloud-done"
        value={syncedStudents === null ? '-' : syncedStudents}
        title="Synced to Database"
        subtitle={
          syncedStudents === null
            ? 'Checking sync status'
            : 'Records fully synchronized'
        }
        color={colors.success}
        bg={colors.surface}
        delay={250}
      />
    </>
  );
}
