import { StyleSheet, Dimensions } from 'react-native';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

const { width, height } = Dimensions.get('window');

export const SCREEN_WIDTH = width;

export function createOnboardingStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flex: 1,
    },

    header: {
      height: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xxl,
    },

    logo: {
      ...type.h3,
      fontFamily: type.display.fontFamily,
      fontSize: 20,
      letterSpacing: 3,
      color: colors.textPrimary,
    },

    logoSubtitle: {
      ...type.overline,
      marginTop: 3,
      fontSize: 8.5,
      letterSpacing: 1.4,
      color: colors.textMuted,
    },

    skipButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },

    skipText: {
      ...type.label,
      fontSize: 12,
      color: colors.textSecondary,
    },

    pressed: {
      opacity: 0.6,
    },

    pager: {
      flex: 1,
    },

    page: {
      width,
      paddingHorizontal: spacing.xxl,
      justifyContent: 'center',
    },

    pageScroll: {
      paddingBottom: spacing.lg,
    },

    heroWrap: {
      height: height * 0.4,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },

    heroGlow: {
      position: 'absolute',
      width: width * 0.72,
      height: height * 0.34,
      borderRadius: radius.xl,
      transform: [{ rotate: '-4deg' }],
      ...shadow.card,
    },

    heroFrame: {
      width: width * 0.62,
      height: height * 0.37,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: colors.surface,
      backgroundColor: colors.surfaceAlt,
      ...shadow.raised,
    },

    heroImage: {
      width: '100%',
      height: '100%',
    },

    heroBadge: {
      position: 'absolute',
      right: width * 0.04,
      bottom: 6,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md - 2,
      ...shadow.goldGlow,
    },

    heroBadgeSmall: {
      ...type.overline,
      fontSize: 7.5,
      letterSpacing: 1.3,
      color: colors.ink,
      opacity: 0.75,
    },

    heroBadgeMain: {
      ...type.h3,
      fontFamily: type.display.fontFamily,
      fontSize: 16,
      letterSpacing: 1.5,
      marginTop: 2,
      color: colors.ink,
    },

    creatorWrap: {
      height: height * 0.33,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },

    avatarRing: {
      width: 138,
      height: 138,
      borderRadius: 69,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      ...shadow.goldGlow,
    },

    avatarInner: {
      width: '100%',
      height: '100%',
      borderRadius: 65,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    creatorName: {
      ...type.h3,
      fontSize: 15,
      marginTop: spacing.lg,
      letterSpacing: 1.6,
      color: colors.textPrimary,
      textAlign: 'center',
    },

    creatorCreds: {
      ...type.overline,
      marginTop: spacing.xs + 2,
      fontSize: 9.5,
      letterSpacing: 1,
      color: colors.textMuted,
      textAlign: 'center',
    },

    purposeWrap: {
      minHeight: height * 0.33,
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },

    purposeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.raised,
    },

    purposeIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.lg,
    },

    purposeTitle: {
      ...type.h3,
      fontSize: 14,
      letterSpacing: 0.4,
      color: colors.textPrimary,
    },

    purposeText: {
      ...type.bodySmall,
      marginTop: 2,
      color: colors.textSecondary,
    },

    eyebrowChip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.goldTint,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      marginBottom: spacing.md,
    },

    eyebrowText: {
      ...type.overline,
      fontSize: 9.5,
      color: colors.goldDark,
    },

    title: {
      ...type.display,
      fontSize: 30,
      lineHeight: 36,
      color: colors.textPrimary,
    },

    body: {
      ...type.body,
      marginTop: spacing.md,
      color: colors.textSecondary,
      maxWidth: 360,
    },

    cdsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: spacing.xl,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },

    cdsIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },

    cdsTextWrap: {
      flex: 1,
    },

    cdsTitle: {
      ...type.label,
      fontSize: 10.5,
      letterSpacing: 1,
      color: colors.textPrimary,
    },

    cdsText: {
      ...type.bodySmall,
      marginTop: spacing.xs,
      color: colors.textSecondary,
    },

    footer: {
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },

    dot: {
      height: 7,
      width: 7,
      borderRadius: 4,
      backgroundColor: colors.borderStrong,
      marginHorizontal: 4,
    },

    dotActive: {
      width: 22,
      backgroundColor: colors.gold,
    },

    cta: {
      height: 58,
      borderRadius: radius.lg,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.button,
    },

    ctaGradient: {
      ...StyleSheet.absoluteFillObject,
    },

    ctaPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.986 }],
    },

    ctaText: {
      ...type.button,
      fontSize: 15.5,
      letterSpacing: 0.4,
      color: colors.textInverse,
      marginRight: spacing.sm,
    },

    arrowCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    footerCaption: {
      ...type.caption,
      marginTop: spacing.md,
      textAlign: 'center',
      letterSpacing: 0.3,
      color: colors.textMuted,
    },
  });
}
