import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Button for students only. Sits below the staff sign-in card.
export default function StudentPortalButton() {
  const navigation = useNavigation();

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Students: log in with your registration number</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => navigation.navigate('StudentPortal')}
        accessibilityRole="button"
        accessibilityLabel="SS3 quiz portal"
      >
        <Text style={styles.buttonText}>SS3 quiz portal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28, alignItems: 'center' },
  hint: { fontSize: 12, color: '#8A8A8A', textAlign: 'center', marginBottom: 10 },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6d28d9',
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#6d28d9', fontWeight: '600', fontSize: 15 },
});
