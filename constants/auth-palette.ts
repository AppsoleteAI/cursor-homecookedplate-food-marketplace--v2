export const AuthColors = {
  gradientTop: '#F7C451',
  gradientUpper: '#F9C85A',
  gradientMid: '#FBD16F',
  gradientLower: '#FCD787',
  gradientBottom: '#FDEED1',
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

/**
 * Honey Fade.
 * Top 10% is a darker honey gold. From there the screen keeps the honey fade,
 * and the light pastel is held through the bottom edge.
 */
export const authGradient = [
  '#C17A10',
  AuthColors.gradientTop,
  AuthColors.gradientUpper,
  AuthColors.gradientMid,
  AuthColors.gradientLower,
  AuthColors.gradientBottom,
  AuthColors.gradientBottom,
] as const;

export const authGradientLocations = [0, 0.1, 0.22, 0.48, 0.74, 0.86, 1] as const;

/**
 * Dark mode pre-app. Not mounted.
 * Swap `authGradient` for this to bring the black-to-yellow background back.
 */
export const authGradientDark = ['#111111', '#121212', '#6A5715', '#CDA311', '#FCD925'] as const;

export const authGradientDarkLocations = [0, 0.32, 0.55, 0.75, 1] as const;

/** Light top edge into a deeper gold, matching the pre-app action buttons. */
export const goldButtonColors = ['#F6CC3E', '#E8B016', '#D39A08'] as const;
