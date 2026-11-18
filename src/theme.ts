import { useColorScheme } from 'react-native';

// Palette from the design mockups: cardamom green accent, turmeric for "expiring", chili for "low".
const light = {
  background: '#F6F7F5',
  card: '#FFFFFF',
  text: '#17201B',
  textMuted: '#6B7570',
  border: '#E5E9E5',
  accent: '#0E7A5C',
  accentSoft: '#E3F2EB',
  onAccent: '#FFFFFF',
  warn: '#B87400',
  warnSoft: '#FFF3D9',
  danger: '#C2412C',
  dangerSoft: '#FCE9E5',
  inputBackground: '#FFFFFF',
};

const dark: typeof light = {
  background: '#0F1412',
  card: '#171E1B',
  text: '#E6EBE8',
  textMuted: '#9BA6A0',
  border: '#28312D',
  accent: '#43C39A',
  accentSoft: '#16332A',
  onAccent: '#0B1A14',
  warn: '#E9B23E',
  warnSoft: '#3A2D0E',
  danger: '#E57360',
  dangerSoft: '#3A1C17',
  inputBackground: '#1D2622',
};

export type Colors = typeof light;
export const palette = { light, dark };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16 },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

/** Colours given to household members in join order (matches join_household in SQL). */
export const memberColors = ['#2F6FB5', '#B5477A', '#C77E00', '#5B8C2A', '#7A55B5', '#2A8C8C'];
