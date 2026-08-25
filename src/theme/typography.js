export const fontFamily = {
  display: 'PlusJakartaSans_800ExtraBold',
  heading: 'PlusJakartaSans_700Bold',
  headingMedium: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const type = {
  display: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
  },
  h1: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 23,
  },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  overline: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  button: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
};
