export const lightColors = {
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F8',
  border: '#D0D9E8',
  text: '#0D1B2A',
  textSecondary: '#4A5568',
  textMuted: '#9AA5B4',
  error: '#E53E3E',
  warning: '#D69E2E',
  success: '#38A169',
  purple: '#6B46C1',
  purpleLight: '#9F7AEA',
  card: '#FFFFFF',
};

export const darkColors = {
  primary: '#4A9EFF',
  primaryDark: '#1A73E8',
  background: '#0D1B2A',
  surface: '#162032',
  surfaceAlt: '#1E2D42',
  border: '#2D3F55',
  text: '#F0F4FF',
  textSecondary: '#9BB3CC',
  textMuted: '#5A7A99',
  error: '#FC8181',
  warning: '#F6C05C',
  success: '#68D391',
  purple: '#9F7AEA',
  purpleLight: '#B794F4',
  card: '#162032',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const getTypography = (colors) => ({
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: 22, fontWeight: '700', color: colors.text },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  small: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
});

// Default export for backward compat
export const colors = lightColors;
export const typography = getTypography(lightColors);