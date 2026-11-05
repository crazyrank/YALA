export const lightColors = {
  mode: 'light',

  // Premium navy and muted blue
  ink: '#101C30',
  inkSoft: '#1C2D46',

  // Surfaces
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FB',
  background: '#F2F4F7',
  border: '#E2E6EC',
  borderStrong: '#CCD3DD',

  // Typography
  textPrimary: '#101C30',
  textSecondary: '#5C6675',
  textMuted: '#8791A0',
  textInverse: '#FFFFFF',

  // School brand, sampled from the school buildings: blue (main) and pink (secondary).
  brand: '#0A74A3', // fills: buttons, chips, active states (dark text on top)
  brandLight: '#8ADBF2',
  brandDark: '#0A74A3', // text and icons on light surfaces
  brandStrong: '#0A74A3', // fills that carry white text
  brandTint: '#E4F3FA',
  pink: '#E8847F', // borders and fills
  pinkDark: '#C24A52', // icons and text on light surfaces
  pinkTint: '#FCEDEC',
  accentPurple: '#5B3A8E',

  // Legacy names kept so older screens keep working. They now point at the blue.
  gold: '#0A74A3',
  goldLight: '#8ADBF2',
  goldDark: '#0A74A3',
  goldTint: '#E4F3FA',

  // Status colours
  success: '#3D8B75',
  successBg: '#E8F2EE',
  error: '#B94B49',
  errorBg: '#F8EAE9',
  warning: '#A77C36',
  warningBg: '#F7F0E2',

  overlay: 'rgba(16,28,48,0.55)',
};

export const darkColors = {
  mode: 'dark',

  // Soft slate instead of midnight navy
  ink: '#161B26',
  inkSoft: '#1E2433',

  // Surfaces
  surface: '#1E2433',
  surfaceAlt: '#232B3D',
  background: '#161B26',
  border: '#2A3142',
  borderStrong: '#363E52',

  // Typography
  textPrimary: '#F2F4F8',
  textSecondary: '#A3ACBE',
  textMuted: '#7D8698',
  textInverse: '#FFFFFF',

  // School brand, sampled from the school buildings: blue (main) and pink (secondary).
  brand: '#2BB3D9', // fills: buttons, chips, active states (dark text on top)
  brandLight: '#7ED6EF',
  brandDark: '#2AA3C8', // text and icons on dark surfaces
  brandStrong: '#1678A0', // fills that carry white text
  brandTint: '#17303D',
  pink: '#F4958F', // borders and fills
  pinkDark: '#F4958F', // icons and text on dark surfaces
  pinkTint: '#3A2530',
  accentPurple: '#B9A2E0',

  // Legacy names kept so older screens keep working. They now point at the blue.
  gold: '#2BB3D9',
  goldLight: '#7ED6EF',
  goldDark: '#2AA3C8',
  goldTint: '#17303D',

  // Status colours
  success: '#7DBBA5',
  successBg: '#1D2F2A',
  error: '#E09A94',
  errorBg: '#33222A',
  warning: '#DDBB78',
  warningBg: '#342D1F',

  overlay: 'rgba(0,0,0,0.6)',
};

// Shared brand gradients
export const gradients = {
  navy: ['#161B26', '#1E2433'],
  navyDeep: ['#11151E', '#161B26'],
  gold: ['#1BA8DD', '#8ADBF2'],
  goldSubtle: ['#17303D', '#1E2433'],
  sheen: [
    'rgba(255,255,255,0.0)',
    'rgba(255,255,255,0.06)',
    'rgba(255,255,255,0.0)',
  ],
};
