import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';

// Wraps a screen with the same header used on Settings and Register Student.
// title can be a string or a function of the screen props.
export default function withScreenHeader(Screen, title) {
  return function ScreenWithHeader(props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const label = typeof title === 'function' ? title(props) : title;
    const canGoBack = props.navigation?.canGoBack?.();

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: insets.top + 6,
            paddingHorizontal: 20,
            paddingBottom: 14,
            backgroundColor: colors.background,
          }}
        >
          {canGoBack && (
            <Pressable
              onPress={() => props.navigation.goBack()}
              hitSlop={12}
              style={{ marginRight: 8 }}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
            </Pressable>
          )}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fontFamily.display,
              fontSize: 28,
              letterSpacing: -0.6,
              color: colors.textPrimary,
            }}
          >
            {label}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>
      </View>
    );
  };
}
