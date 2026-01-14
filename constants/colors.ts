export const Colors = {
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  gradient: {
    green: '#22C55E',
    yellow: '#FACC15',
    orange: '#F97316',
    red: '#EF4444',
    darkGold: '#8B6914',
  },
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

export type BaseColor = 'green' | 'yellow' | 'orange' | 'red' | 'gold' | 'purple';

export const monoGradients: Record<BaseColor, [string, string]> = {
  green: ['#16A34A', '#86EFAC'],
  yellow: ['#CA8A04', '#FEF08A'],
  orange: ['#C2410C', '#FED7AA'],
  red: ['#B91C1C', '#FECACA'],
  gold: ['#8B6914', '#D4AF37'],
  purple: ['#7C3AED', '#C4B5FD'],
} as const;

export const gradientColors = [
  Colors.gradient.green,
  Colors.gradient.yellow,
  Colors.gradient.orange,
  Colors.gradient.red,
] as const;