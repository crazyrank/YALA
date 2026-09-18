export const lightColors = {
  mode: 'light',

  // Core ink / surfaces
  ink: '#0A1930',
  inkSoft: '#16324F',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFBFD',
  background: '#F5F7FA',

  // Borders
  border: '#E4E8EF',
  borderStrong: '#D5DAE3',

  // Text
  textPrimary: '#0A1930',
  textSecondary: '#5B6472',
  textMuted: '#8A94A3',
  textInverse: '#FFFFFF',

  // Gold accent (premium highlight)
  gold: '#C9A24B',
  goldLight: '#E7C878',
  goldDark: '#9C7A32',
  goldTint: '#FBF3E1',

  // Feedback
  success: '#12805C',
  successBg: '#E7F6EF',
  error: '#C0392B',
  errorBg: '#FDECEA',
  warning: '#B7791F',
  warningBg: '#FEF3E2',

  overlay: 'rgba(10,25,48,0.55)',
};

export const darkColors = {
  mode: 'dark',

  // Core ink / surfaces — lighter navy so brand elements still pop
  ink: '#16324F',
  inkSoft: '#22456B',
  surface: '#141B2E',
  surfaceAlt: '#1B2438',
  background: '#0B1220',

  // Borders
  border: '#232D45',
  borderStrong: '#2E3A56',

  // Text
  textPrimary: '#F2F4F8',
  textSecondary: '#AEB6C4',
  textMuted: '#7C879C',
  textInverse: '#FFFFFF',

  // Gold accent — brightened slightly for dark backgrounds
  gold: '#D8B563',
  goldLight: '#EDD9A0',
  goldDark: '#B4913E',
  goldTint: '#241F12',

  // Feedback
  success: '#33B786',
  successBg: '#123A2B',
  error: '#E5695A',
  errorBg: '#3A1614',
  warning: '#E0B04A',
  warningBg: '#3A2C0F',

  overlay: 'rgba(0,0,0,0.6)',
};

// Brand gradients stay consistent across themes.
export const gradients = {
  navy: ['#0A1930', '#16324F'],
  navyDeep: ['#071120', '#0A1930'],
  gold: ['#C9A24B', '#E7C878'],
  goldSubtle: ['#F4E8CC', '#FFFFFF'],
  sheen: ['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.0)'],
};
