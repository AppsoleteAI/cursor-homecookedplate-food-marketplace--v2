export const AuthColors = {
  gradientTop: '#F54100',
  gradientMid: '#FF9400',
  gradientBottom: '#FFE709',
  card: '#F0C048',
  brand: '#FFE14A',
  button: '#FFE14A',
  maroon: '#48101E',
  ink: '#14100C',
  muted: '#5C4636',
  field: '#FFFFFF',
  placeholder: '#8A7568',
  error: '#8E1D36',
  white: '#FFFFFF',
} as const;

export const authGradient = [
  AuthColors.gradientTop,
  AuthColors.gradientMid,
  AuthColors.gradientBottom,
] as const;
