import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DashboardStatCard({
  icon,
  value,
  title,
  subtitle,
  color = '#3157D5',
  bg = '#EAF2FF',
}) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={[styles.icon, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>

      <Text style={[styles.value, { color }]}>
        {value}
      </Text>

      <Text style={styles.title}>
        {title}
      </Text>

      <Text style={styles.subtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 130,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },

  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  iconText: {
    color: '#fff',
    fontSize: 16,
  },

  value: {
    fontSize: 25,
    fontWeight: '900',
  },

  title: {
    color: '#344054',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },

  subtitle: {
    color: '#667085',
    fontSize: 8,
    marginTop: 4,
  },
});
