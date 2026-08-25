import { StyleSheet } from 'react-native';
import { type, fontFamily } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

// Theme-aware styles: pass the active `colors` object (light or dark) in.
export const createLoginStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raised,
  },

  logo: {
    width: 44,
    height: 44,
  },

  brandName: {
    ...type.h3,
    fontFamily: fontFamily.display,
    fontSize: 20,
    letterSpacing: 1.4,
    color: colors.ink,
  },

  brandSub: {
    marginTop: 3,
    ...type.overline,
    fontSize: 9,
    color: colors.textMuted,
  },

  intro: {
    marginTop: spacing.xxxl + 4,
    marginBottom: spacing.xl,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginRight: spacing.sm - 1,
  },

  badgeText: {
    ...type.overline,
    fontSize: 10.5,
    color: colors.textSecondary,
  },

  title: {
    ...type.display,
    fontSize: 34,
    lineHeight: 39,
    color: colors.ink,
  },

  subtitle: {
    marginTop: spacing.sm + 2,
    maxWidth: 330,
    ...type.body,
    fontSize: 15,
    color: colors.textSecondary,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  cardTitle: {
    ...type.h2,
    fontSize: 21,
    color: colors.ink,
  },

  cardSub: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    ...type.bodySmall,
    fontSize: 13,
    color: colors.textMuted,
  },

  label: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    ...type.label,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  inputBox: {
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md + 2,
  },

  inputIcon: {
    marginRight: spacing.sm,
  },

  inputFocus: {
    borderColor: colors.gold,
    backgroundColor: colors.goldTint,
    ...shadow.goldGlow,
  },

  input: {
    flex: 1,
    height: '100%',
    ...type.bodyMedium,
    fontSize: 15.5,
    color: colors.ink,
  },

  show: {
    ...type.label,
    fontSize: 11,
    color: colors.ink,
  },

  error: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: '#F3C7C3',
    borderRadius: radius.md - 1,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },

  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FDE2E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  errorText: {
    flex: 1,
    ...type.bodySmall,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12.5,
    color: colors.error,
  },

  login: {
    height: 58,
    borderRadius: radius.lg - 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.button,
  },

  loginGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.65,
  },

  loginText: {
    ...type.button,
    fontSize: 16,
    color: colors.textInverse,
  },

  arrowWrap: {
    marginLeft: spacing.sm + 2,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg + 2,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    marginHorizontal: spacing.sm + 1,
    ...type.overline,
    fontSize: 9.5,
    color: colors.textMuted,
  },

  bio: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg - 1,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bioPressed: {
    backgroundColor: colors.goldTint,
    borderColor: colors.gold,
  },

  bioIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bioInfo: {
    flex: 1,
    marginLeft: spacing.md - 1,
  },

  bioTitle: {
    ...type.bodyMedium,
    fontSize: 13.5,
    fontFamily: fontFamily.bodySemibold,
    color: colors.ink,
  },

  bioSub: {
    marginTop: 2,
    ...type.caption,
    fontSize: 10.5,
    color: colors.textMuted,
  },

  bioLoading: {
    marginLeft: spacing.sm + 1,
    ...type.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },

  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },

  footerLine: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginBottom: spacing.sm,
  },

  footerTitle: {
    ...type.overline,
    fontSize: 10.5,
    letterSpacing: 2.4,
    color: colors.ink,
  },

  footerText: {
    marginTop: 3,
    ...type.caption,
    fontSize: 10.5,
    color: colors.textMuted,
  },

  footerSchool: {
    marginTop: 2,
    ...type.caption,
    fontSize: 9.5,
    color: '#B0B7C3',
  },
});
