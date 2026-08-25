import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  scroll: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    elevation: 2,
  },

  logo: {
    width: 45,
    height: 45,
  },

  brandName: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: '#0B1F33',
  },

  brandSub: {
    marginTop: 3,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#8A94A3',
  },

  intro: {
    marginTop: 38,
    marginBottom: 20,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9A24B',
    marginRight: 7,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#667085',
  },

  title: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -1,
    color: '#0B1F33',
  },

  subtitle: {
    marginTop: 8,
    maxWidth: 330,
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: '#E7E9ED',
    elevation: 3,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0B1F33',
  },

  cardSub: {
    marginTop: 3,
    marginBottom: 20,
    fontSize: 11,
    color: '#8A94A3',
  },

  label: {
    marginBottom: 7,
    marginTop: 3,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#475467',
  },

  inputBox: {
    height: 51,
    borderWidth: 1,
    borderColor: '#D5D9E0',
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    marginBottom: 14,
  },

  inputFocus: {
    borderColor: '#C9A24B',
    backgroundColor: '#FFFDF8',
  },

  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F33',
  },

  show: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#0B1F33',
  },

  error: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    borderWidth: 1,
    borderColor: '#F3C7C3',
    borderRadius: 11,
    padding: 10,
    marginBottom: 13,
  },

  errorIcon: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FDE2E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  errorMark: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B42318',
  },

  errorText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#B42318',
  },

  login: {
    height: 53,
    borderRadius: 13,
    backgroundColor: '#0B1F33',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.65,
  },

  loginText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  arrow: {
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A24B',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8EAEE',
  },

  dividerText: {
    marginHorizontal: 9,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#98A2B3',
  },

  bio: {
    minHeight: 64,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D5D9E0',
    borderRadius: 13,
    backgroundColor: '#FAFBFC',
    flexDirection: 'row',
    alignItems: 'center',
  },

  bioPressed: {
    backgroundColor: '#F0F2F5',
  },

  bioIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#D5D9E0',
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bioInner: {
    width: 15,
    height: 20,
    borderWidth: 2,
    borderColor: '#0B1F33',
    borderRadius: 9,
  },

  bioInfo: {
    flex: 1,
    marginLeft: 11,
  },

  bioTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B1F33',
  },

  bioSub: {
    marginTop: 2,
    fontSize: 9,
    color: '#98A2B3',
  },

  bioArrow: {
    fontSize: 19,
    color: '#667085',
  },

  bioLoading: {
    marginLeft: 9,
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1F33',
  },

  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },

  footerLine: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C9A24B',
    marginBottom: 8,
  },

  footerTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#0B1F33',
  },

  footerText: {
    marginTop: 3,
    fontSize: 8,
    color: '#8A94A3',
  },

  footerSchool: {
    marginTop: 2,
    fontSize: 7,
    color: '#B0B7C3',
  },
});
