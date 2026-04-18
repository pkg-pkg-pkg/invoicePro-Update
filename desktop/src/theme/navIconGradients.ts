import { alpha } from '@mui/material/styles';

/** Stable sidebar icon gradient from nav id + theme primary fallback. */
export function navIconGradientForKey(key: string, primaryMain: string): string {
  const k = String(key ?? '').toLowerCase();
  let hue = 210;
  for (let i = 0; i < k.length; i += 1) hue = (hue + k.charCodeAt(i) * 7) % 360;
  const c1 = `hsl(${hue} 78% 42%)`;
  const c2 = alpha(primaryMain, 0.92);
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}
