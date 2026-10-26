import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE5',
  text: '#1C1B22',
  muted: '#6B6878',
  border: '#E4E0D8',
  primary: '#3D2C8D',
  onPrimary: '#FFFFFF',
  positive: '#1F7A52',
  positiveBg: '#DDF3E8',
  negative: '#B8392A',
  negativeBg: '#FBE3DE',
  warning: '#9A6411',
  warningBg: '#FBEFD5',
  pill: '#ECE9E2',
  overlay: 'rgba(20, 18, 30, 0.45)',
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#121117',
  surface: '#1C1B23',
  surfaceAlt: '#25232E',
  text: '#F2F0F7',
  muted: '#9C98AA',
  border: '#2C2A36',
  primary: '#A797F5',
  onPrimary: '#121117',
  positive: '#5ACB94',
  positiveBg: '#173327',
  negative: '#F28572',
  negativeBg: '#3A1C17',
  warning: '#E6B450',
  warningBg: '#392C12',
  pill: '#2A2833',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
