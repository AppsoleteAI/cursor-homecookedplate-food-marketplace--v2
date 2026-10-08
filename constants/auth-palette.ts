export const AuthColors = {
  gradientTop: '#111111',
  gradientUpper: '#121212',
  gradientMid: '#6A5715',
  gradientLower: '#CDA311',
  gradientBottom: '#FCD925',
  card: '#F0C048',
  brand: '#FFE14A',
  button: '#E8B84C',
  /** Face of the pre-app gold action buttons. */
  gold: '#E8B016',
  maroon: '#48101E',
  /** Apple and Google buttons, a step darker than the maroon used elsewhere. */
  maroonDeep: '#3A0D18',
  ink: '#14100C',
  muted: '#5C4636',
  onDark: '#E8E4DC',
  field: '#FFFFFF',
  placeholder: '#8A7568',
  error: '#8E1D36',
  white: '#FFFFFF',
} as const;

/** Black through the top of the pre-app, then gold into yellow. */
export const authGradient = [
  AuthColors.gradientTop,
  AuthColors.gradientUpper,
  AuthColors.gradientMid,
  AuthColors.gradientLower,
  AuthColors.gradientBottom,
] as const;

export const authGradientLocations = [0, 0.32, 0.55, 0.75, 1] as const;

/** Light top edge into a deeper gold, matching the pre-app action buttons. */
export const goldButtonColors = ['#F6CC3E', '#E8B016', '#D39A08'] as const;
