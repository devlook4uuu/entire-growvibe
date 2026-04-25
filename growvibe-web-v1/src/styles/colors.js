// ─── GrowVibe Design Tokens ───────────────────────────────────────────────────
// Single source of truth for all color values used across the app.
// Import this wherever you need colors — do NOT hardcode hex values in components.

export const C = {
  // Brand
  primary:      '#1CACF3',
  primaryDark:  '#0E8AD4',
  primaryLight: '#E8F6FE',

  // Surfaces
  white:  '#FFFFFF',
  canvas: '#F5F7FA',
  hover:  '#F0F4F8',

  // Text
  ink:   '#1A1D21',
  soft:  '#64748B',
  muted: '#94A3B8',

  // Borders
  border:      '#E2E8F0',
  borderLight: '#F1F5F9',

  // Semantic — success
  success:      '#22C55E',
  successLight: '#ECFDF5',

  // Semantic — warning
  warning:      '#F59E0B',
  warningLight: '#FFFBEB',

  // Semantic — danger
  danger:       '#EF4444',
  dangerLight:  '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText:   '#B91C1C',

  // Semantic — info
  info:      '#1CACF3',
  infoLight: '#E8F6FE',

  // Extended palette
  purple:      '#8B5CF6',
  purpleLight: '#F5F3FF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  green:       '#22C55E',
  greenLight:  '#ECFDF5',
  sky:         '#0EA5E9',
  skyLight:    '#F0F9FF',
};

export const FONT = "'DM Sans', system-ui, -apple-system, sans-serif";

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
};
