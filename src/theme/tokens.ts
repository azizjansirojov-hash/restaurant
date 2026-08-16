export const colors = {
  charcoal: '#1A1614',
  stone: '#E8E0D5',
  pomegranate: '#9B2D35',
  pomegranateDeep: '#7A2229',
  olive: '#3F5A45',
  oliveSoft: '#5A7560',
  cream: '#F5F0E8',
  creamMuted: 'rgba(245,240,232,0.72)',
  hairline: '#C9BEB0',
  inkMuted: 'rgba(26,22,20,0.62)',
  inkFaint: 'rgba(26,22,20,0.38)',
  white: '#FFFFFF',
  danger: '#8B1E1E',
  overlay: 'rgba(26,22,20,0.48)',
  overlayDeep: 'rgba(26,22,20,0.62)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
} as const;

export const type = {
  display: {
    fontFamily: 'Fraunces_600SemiBold',
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    letterSpacing: 0.1,
  },
  bodyMedium: {
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.15,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
export const minTap = 48;
