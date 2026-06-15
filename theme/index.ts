// theme/index.ts
// Design tokens derived from DESIGN.md (Lumina Mobile Home)

export const Colors = {
  // Backgrounds
  background:              '#0f0f0f',
  surface:                 '#0c141f',
  surfaceDim:              '#0c141f',
  surfaceBright:           '#323946',
  surfaceContainerLowest:  '#070e19',
  surfaceContainerLow:     '#151c27',
  surfaceContainer:        '#19202b',
  surfaceContainerHigh:    '#232a36',
  surfaceContainerHighest: '#2e3541',
  surfaceVariant:          '#2e3541',
  surfaceCard:             '#1a1a1a',
  surfaceElevated:         '#242424',

  // On-surface
  onBackground:     '#dce2f3',
  onSurface:        '#dce2f3',
  onSurfaceVariant: '#c2c6d6',
  inverseOnSurface: '#2a313d',
  inverseSurface:   '#dce2f3',

  // Outline
  outline:        '#8c909f',
  outlineVariant: '#424754',

  // Primary (Electric Blue)
  primary:              '#adc6ff',
  onPrimary:            '#002e6a',
  primaryContainer:     '#4d8eff',
  onPrimaryContainer:   '#00285d',
  inversePrimary:       '#005ac2',
  primaryFixed:         '#d8e2ff',
  primaryFixedDim:      '#adc6ff',
  onPrimaryFixed:       '#001a42',
  onPrimaryFixedVariant:'#004395',
  surfaceTint:          '#adc6ff',

  // Secondary (Green — online/success)
  secondary:              '#4ae176',
  onSecondary:            '#003915',
  secondaryContainer:     '#00b954',
  onSecondaryContainer:   '#004119',
  secondaryFixed:         '#6bff8f',
  secondaryFixedDim:      '#4ae176',
  onSecondaryFixed:       '#002109',
  onSecondaryFixedVariant:'#005321',

  // Tertiary (Amber — warnings, warm spectrum)
  tertiary:              '#ffb95f',
  onTertiary:            '#472a00',
  tertiaryContainer:     '#ca8100',
  onTertiaryContainer:   '#3e2400',
  tertiaryFixed:         '#ffddb8',
  tertiaryFixedDim:      '#ffb95f',
  onTertiaryFixed:       '#2a1700',
  onTertiaryFixedVariant:'#653e00',

  // Error
  error:            '#ef4444',
  onError:          '#690005',
  errorContainer:   '#93000a',
  onErrorContainer: '#ffdad6',

  // Temperature spectrum
  coolSpectrum: '#60a5fa',
  warmSpectrum: '#fbbf24',
} as const;

export const Typography = {
  headlineLg: {
    fontFamily: 'Metropolis-SemiBold',
    fontSize:   24,
    lineHeight: 32,
    letterSpacing: -0.48,
    fontWeight: '600' as const,
  },
  headlineMd: {
    fontFamily: 'Metropolis-SemiBold',
    fontSize:   20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  bodyLg: {
    fontFamily: 'Metropolis-Regular',
    fontSize:   16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMd: {
    fontFamily: 'Metropolis-Regular',
    fontSize:   14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  labelMd: {
    fontFamily:    'Metropolis-Medium',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: 0.12,
    fontWeight:    '500' as const,
  },
  labelSm: {
    fontFamily: 'Metropolis-SemiBold',
    fontSize:   11,
    lineHeight: 14,
    fontWeight: '600' as const,
  },
  dataNumeric: {
    fontFamily: 'Metropolis-SemiBold',
    fontSize:   18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
} as const;

export const Spacing = {
  marginMobile: 16,   // 1rem
  gutterMobile: 12,   // 0.75rem
  stackSm:      8,    // 0.5rem
  stackMd:      16,   // 1rem
  touchMin:     44,
} as const;

export const Radius = {
  sm:   4,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
} as const;

// Elevation shadows (React Native shadow props)
export const Shadows = {
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius:  12,
    elevation:     8,
  },
  elevated: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius:  6,
    elevation:     4,
  },
} as const;
