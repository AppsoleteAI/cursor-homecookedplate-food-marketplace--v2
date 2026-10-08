import { AuthColors } from '@/constants/auth-palette';
import { monoGradients } from '@/constants/colors';

const STYLE_ID = 'hcp-scrollbar';

const CSS = `
html, body, * {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, ${AuthColors.brand}) transparent;
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  background: transparent;
}
*::-webkit-scrollbar-track,
*::-webkit-scrollbar-track-piece,
*::-webkit-scrollbar-corner {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb, ${AuthColors.brand});
  border-radius: 999px;
}
`;

const HEADER_COLORS: [string, string][] = [
  ['/farm-grown-basket', monoGradients.green[0]],
  ['/food-truck-popup', monoGradients.orange[0]],
  ['/sit-down-delicious', monoGradients.gold[0]],
  ['/cater-event-deliver', monoGradients.purple[0]],
  ['/meal-prep-go', monoGradients.blue[0]],
  ['/search', monoGradients.orange[0]],
  ['/filter', monoGradients.orange[0]],
  ['/funnel', monoGradients.orange[0]],
  ['/create-meal', monoGradients.orange[0]],
  ['/cart', monoGradients.green[0]],
  ['/dashboard', monoGradients.green[0]],
  ['/buyer-dashboard', monoGradients.red[0]],
  ['/orders', monoGradients.gold[0]],
  ['/active-orders', monoGradients.green[0]],
  ['/admin-dashboard', monoGradients.purple[0]],
  ['/admin-payout-review', monoGradients.purple[0]],
  ['/admin/alerts', monoGradients.blue[0]],
  ['/admin-metro-caps', monoGradients.blue[0]],
  ['/panic-dashboard', monoGradients.red[0]],
  ['/profile', monoGradients.gold[0]],
  ['/reviews-dashboard', monoGradients.green[0]],
  ['/promotions', monoGradients.green[0]],
  ['/finance', monoGradients.green[0]],
  ['/food-review-clips', monoGradients.green[0]],
  ['/payout-responsibility', monoGradients.green[0]],
  ['/checkout', monoGradients.yellow[0]],
  ['/notifications-bell', monoGradients.yellow[0]],
  ['/legal', AuthColors.brand],
  ['/privacy', AuthColors.brand],
  ['/terms', AuthColors.brand],
  ['/kitchen-rules', AuthColors.brand],
  ['/food-handling', AuthColors.brand],
  ['/login', AuthColors.brand],
  ['/signup', AuthColors.brand],
  ['/welcome', AuthColors.brand],
  ['/onboarding', AuthColors.brand],
  ['/recover', AuthColors.brand],
  ['/reset-password', AuthColors.brand],
  ['/verify-email', AuthColors.brand],
  ['/hardware-mismatch', AuthColors.brand],
];

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function scrollbarAccentForPath(path: string) {
  const value = path.split('?')[0] || '/';
  const match = HEADER_COLORS.find(([prefix]) => matches(value, prefix));
  return match ? match[1] : monoGradients.yellow[0];
}

export function applyScrollbarAccent(path: string) {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  document.documentElement.style.setProperty('--scrollbar-thumb', scrollbarAccentForPath(path));
}
