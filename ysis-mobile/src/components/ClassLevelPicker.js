import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { CLASS_ORDER } from '../utils/classProgression';

/**
 * Choice of class level from the official list, so a typo such as "PRINAF"
 * cannot be entered. Pass `allowed` to limit choices (for example to one
 * division); by default every class in CLASS_ORDER is shown.
 */
export default function ClassLevelPicker({ value, onChange, allowed }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const options = allowed || CLASS_ORDER;

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {options.map((cls) => {
        const selected = cls === value;
        return (
          <Pressable
            key={cls}
            onPress={() => onChange(cls)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{cls}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    labelSelected: { color: colors.ink },
  });
}
