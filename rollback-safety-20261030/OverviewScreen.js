import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { getDb } from '../db';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';

const STATUS_META = {
  active: { label: 'Active', color: '#2F9D78' },
  registered: { label: 'Registered', color: '#5C83C6' },
  promoted: { label: 'Promoted', color: '#B99A5B' },
  graduated: { label: 'Graduated', color: '#8C72B8' },
  transferred: { label: 'Transferred', color: '#D28A52' },
  withdrawn: { label: 'Withdrawn', color: '#C66B70' },
  expelled: { label: 'Expelled', color: '#A64F54' },
  archived: { label: 'Archived', color: '#8791A0' },
};

const numberFormat = (value) =>
  Number(value || 0).toLocaleString();

function SectionHeading({ title, subtitle, action, onAction, colors }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!action && (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={[styles.sectionActionText, { color: colors.gold }]}>
            {action}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.gold} />
        </Pressable>
      )}
    </View>
  );
}

function MetricCard({ icon, label, value, note, tint, colors, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: tint + '20' }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
        {numberFormat(value)}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      {!!note && (
        <Text style={[styles.metricNote, { color: colors.textMuted }]}>
          {note}
        </Text>
      )}
    </Pressable>
  );
}

function DonutChart({ data, total, colors, onSegmentPress }) {
  const size = 184;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.filter((item) => item.value > 0);

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {segments.map((item) => {
          const length = (item.value / Math.max(total, 1)) * circumference;
          const currentOffset = offset;
          offset += length;

          return (
            <Circle
              key={item.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={item.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(length - 2, 0)} ${circumference}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              fill="none"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
              onPress={() => onSegmentPress?.(item)}
            />
          );
        })}
      </Svg>

      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={[styles.donutTotal, { color: colors.textPrimary }]}>
          {numberFormat(total)}
        </Text>
        <Text style={[styles.donutCaption, { color: colors.textMuted }]}>
          STUDENTS
        </Text>
      </View>
    </View>
  );
}

function ClassBar({ item, max, colors, onPress }) {
  const width =
    max > 0
      ? Math.max(3, (Number(item.student_count) / max) * 100)
      : 0;

  return (
    <Pressable onPress={onPress} style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text
          style={[styles.barLabel, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.class_level}
        </Text>
        <Text style={[styles.barValue, { color: colors.textSecondary }]}>
          {numberFormat(item.student_count)}
        </Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
        <View
          style={[
            styles.barFill,
            { width: `${width}%`, backgroundColor: colors.gold },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function OverviewScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [data, setData] = useState({
    total: 0,
    enrolled: 0,
    active: 0,
    classes: [],
    statuses: [],
    staff: 0,
    conflicts: 0,
  });

  const loadOverview = useCallback(async () => {
    const db = await getDb();

    const summary = await db.getFirstAsync(
      `SELECT
        COUNT(*) AS total,
        SUM(
          CASE WHEN status IN ('registered','active','promoted')
          THEN 1 ELSE 0 END
        ) AS enrolled,
        SUM(
          CASE WHEN status = 'active'
          THEN 1 ELSE 0 END
        ) AS active
       FROM students`
    );

    const classes = await db.getAllAsync(
      `SELECT class_level, COUNT(*) AS student_count
       FROM students
       WHERE status IN ('registered','active','promoted')
       AND TRIM(class_level) != ''
       GROUP BY class_level
       ORDER BY class_level ASC`
    );

    const statuses = await db.getAllAsync(
      `SELECT status, COUNT(*) AS value
       FROM students
       GROUP BY status
       ORDER BY value DESC`
    );

    let staffCount = 0;
    let conflictCount = 0;

    const optionalRequests = [api.get('/directory')];

    if (isAdmin) {
      optionalRequests.push(api.get('/conflicts?status=open'));
    }

    const optionalResults = await Promise.allSettled(optionalRequests);

    const directoryResult = optionalResults[0];

    if (directoryResult.status === 'fulfilled') {
      const directory = directoryResult.value || {};

      staffCount = ['board', 'management', 'classTeachers'].reduce(
        (sum, key) =>
          sum +
          (Array.isArray(directory[key]) ? directory[key].length : 0),
        0
      );
    }

    if (isAdmin && optionalResults[1]?.status === 'fulfilled') {
      conflictCount = Array.isArray(optionalResults[1].value?.conflicts)
        ? optionalResults[1].value.conflicts.length
        : 0;
    }

    setData({
      total: Number(summary?.total || 0),
      enrolled: Number(summary?.enrolled || 0),
      active: Number(summary?.active || 0),
      classes,
      statuses: statuses.map((row) => ({
        key: row.status,
        label: STATUS_META[row.status]?.label || row.status,
        value: Number(row.value || 0),
        color: STATUS_META[row.status]?.color || '#8791A0',
      })),
      staff: staffCount,
      conflicts: conflictCount,
    });

    setError('');
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      setLoading(true);

      loadOverview()
        .catch((err) => {
          if (alive) {
            setError(err?.message || 'Could not load dashboard data.');
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });

      return () => {
        alive = false;
      };
    }, [loadOverview])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadOverview();
    } catch (err) {
      setError(err?.message || 'Could not refresh dashboard.');
    } finally {
      setRefreshing(false);
    }
  }, [loadOverview]);

  const maxClassCount = useMemo(
    () =>
      Math.max(
        0,
        ...data.classes.map(
          (item) => Number(item.student_count) || 0
        )
      ),
    [data.classes]
  );

  const goStudents = () =>
    navigation.navigate('StudentsTab', {
      classLevel: undefined,
      status: undefined,
    });

  const goStudentStatus = (item) =>
    navigation.navigate('StudentsTab', {
      classLevel: undefined,
      status: item.key,
    });

  const goClasses = () => navigation.navigate('ClassesTab');


  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 14) + 8,
            paddingBottom: 28,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topLine}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>
              YALAMATRIX SCHOOLS
            </Text>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
              Overview
            </Text>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Welcome back, {user?.full_name?.split(' ')[0] || 'there'}.
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('MoreTab')}
            style={[
              styles.profileButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="grid-outline"
              size={21}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        {!!error && (
          <Pressable
            onPress={onRefresh}
            style={[styles.errorBanner, { backgroundColor: colors.errorBg }]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.error}
            />
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error} Tap to retry.
            </Text>
          </Pressable>
        )}

        <SectionHeading
          title="School at a glance"
          subtitle="Live totals from this device's student records"
          colors={colors}
        />

        {loading && data.total === 0 ? (
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading school overview…
            </Text>
          </View>
        ) : (
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="people-outline"
              label="Total students"
              value={data.total}
              note="All stored records"
              tint="#5C83C6"
              colors={colors}
              onPress={goStudents}
            />

            <MetricCard
              icon="person-circle-outline"
              label="Enrolled"
              value={data.enrolled}
              note="Registered, active & promoted"
              tint="#2F9D78"
              colors={colors}
              onPress={goStudents}
            />

            <MetricCard
              icon="school-outline"
              label="Classes"
              value={data.classes.length}
              note="With enrolled students"
              tint="#B99A5B"
              colors={colors}
              onPress={goClasses}
            />

            <MetricCard
              icon="person-outline"
              label="Active students"
              value={data.active}
              note="Currently marked active"
              tint="#8C72B8"
              colors={colors}
              onPress={goStudents}
            />
          </View>
        )}

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeading
            title="Student status"
            subtitle="Tap a segment to open student records"
            colors={colors}
          />

          {data.total > 0 ? (
            <View style={styles.statusChartLayout}>
              <DonutChart
                data={data.statuses}
                total={data.total}
                colors={colors}
                onSegmentPress={goStudentStatus}
              />

              <View style={styles.legend}>
                {data.statuses.slice(0, 6).map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => goStudentStatus(item)}
                    style={styles.legendRow}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.legendLabel,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.legendValue,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {numberFormat(item.value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textMuted }]}>
              Student status analytics will appear when records are available.
            </Text>
          )}
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeading
            title="Class distribution"
            subtitle="Enrolled students by class level"
            action="View classes"
            onAction={goClasses}
            colors={colors}
          />

          {data.classes.length ? (
            data.classes.map((item) => (
              <ClassBar
                key={item.class_level}
                item={item}
                max={maxClassCount}
                colors={colors}
                onPress={() =>
                  navigation.navigate('StudentsTab', {
                    classLevel: item.class_level,
                    status: undefined,
                  })
                }
              />
            ))
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textMuted }]}>
              Class distribution will appear when students have been assigned
              to classes.
            </Text>
          )}
        </View>

        <SectionHeading
          title="School operations"
          subtitle="Quick access to existing management tools"
          colors={colors}
        />

        <View style={styles.operationsGrid}>
          <Pressable
            onPress={() =>
              navigation.navigate('MoreTab', { screen: 'StaffDirectory' })
            }
            style={[
              styles.operationCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.operationIcon, { backgroundColor: '#5C83C620' }]}>
              <Ionicons name="people" size={20} color="#5C83C6" />
            </View>
            <Text style={[styles.operationValue, { color: colors.textPrimary }]}>
              {numberFormat(data.staff)}
            </Text>
            <Text style={[styles.operationLabel, { color: colors.textSecondary }]}>
              Staff directory
            </Text>
            <Ionicons name="arrow-forward-outline" size={16} color={colors.textMuted} style={styles.operationArrow} />
          </Pressable>

          {isAdmin && (
            <Pressable
              onPress={() => navigation.navigate('ConflictsTab')}
              style={[
                styles.operationCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.operationIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="git-merge-outline" size={20} color={colors.warning} />
              </View>
              <Text style={[styles.operationValue, { color: colors.textPrimary }]}>
                {numberFormat(data.conflicts)}
              </Text>
              <Text style={[styles.operationLabel, { color: colors.textSecondary }]}>
                Open conflicts
              </Text>
              <Ionicons name="arrow-forward-outline" size={16} color={colors.textMuted} style={styles.operationArrow} />
            </Pressable>
          )}

          <Pressable
            onPress={() =>
              navigation.navigate('MoreTab', { screen: 'ManageStaff' })
            }
            style={[
              styles.operationCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.operationIcon, { backgroundColor: colors.goldTint }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.operationValue, { color: colors.textPrimary }]}>
              Manage
            </Text>
            <Text style={[styles.operationLabel, { color: colors.textSecondary }]}>
              Staff accounts
            </Text>
            <Ionicons name="arrow-forward-outline" size={16} color={colors.textMuted} style={styles.operationArrow} />
          </Pressable>

          <Pressable
            onPress={() =>
              navigation.navigate('MoreTab', { screen: 'ImportStudents' })
            }
            style={[
              styles.operationCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.operationIcon, { backgroundColor: '#2F9D7820' }]}>
              <Ionicons name="cloud-upload-outline" size={20} color="#2F9D78" />
            </View>
            <Text style={[styles.operationValue, { color: colors.textPrimary }]}>
              Import
            </Text>
            <Text style={[styles.operationLabel, { color: colors.textSecondary }]}>
              Student records
            </Text>
            <Ionicons name="arrow-forward-outline" size={16} color={colors.textMuted} style={styles.operationArrow} />
          </Pressable>
        </View>

        <Text style={[styles.footerNote, { color: colors.textMuted }]}>
          Figures reflect records currently available on this device. Pull down
          to refresh.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },
  topLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  eyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.7,
  },
  pageTitle: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  greeting: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    marginTop: 3,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    marginTop: 3,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  sectionActionText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 11,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.2%',
    minHeight: 132,
    borderRadius: 17,
    borderWidth: 1,
    padding: 13,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: fontFamily.display,
    fontSize: 25,
    letterSpacing: -0.6,
  },
  metricLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 12,
    marginTop: 2,
  },
  metricNote: {
    fontFamily: fontFamily.body,
    fontSize: 9,
    marginTop: 4,
  },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
  },
  statusChartLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  donutWrap: {
    width: 184,
    height: 184,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: {
    fontFamily: fontFamily.display,
    fontSize: 23,
  },
  donutCaption: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  legend: {
    flex: 1,
    gap: 11,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 10,
  },
  legendValue: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 10,
  },
  emptyChart: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 19,
    paddingVertical: 12,
  },
  barRow: {
    marginTop: 13,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  barLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 12,
    flex: 1,
  },
  barValue: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 11,
  },
  barTrack: {
    height: 9,
    borderRadius: 9,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 9,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  operationCard: {
    width: '48.2%',
    minHeight: 116,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    position: 'relative',
  },
  operationIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  operationValue: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
  },
  operationLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    marginTop: 2,
  },
  operationArrow: {
    position: 'absolute',
    top: 13,
    right: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  loadingCard: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  footerNote: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    textAlign: 'center',
    marginTop: -5,
  },
});
