import { AuthColors, authGradientCss } from '@/constants/auth-palette';
import { Colors, pagePastel } from '@/constants/colors';

const HONEY = [
  '/',
  '/login',
  '/signup',
  '/welcome',
  '/onboarding',
  '/recover',
  '/reset-password',
  '/verify-email',
  '/hardware-mismatch',
  '/legal',
  '/kitchen-rules',
  '/food-handling',
  '/privacy',
  '/terms',
  '/support',
];

/** Screen fill behind each route, so a short layout box does not reveal the browser white. */
const PAGE_COLOR: [string, string][] = [
  ['/home', pagePastel.yellow],
  ['/farm-grown-basket', pagePastel.green],
  ['/food-truck-popup', pagePastel.orange],
  ['/sit-down-delicious', pagePastel.yellow],
  ['/cater-event-deliver', pagePastel.purple],
  ['/meal-prep-go', pagePastel.blue],
  ['/search', pagePastel.orange],
  ['/filter', pagePastel.orange],
  ['/create-meal', pagePastel.red],
  ['/publish-plate', pagePastel.red],
  ['/cart', pagePastel.green],
  ['/dashboard', pagePastel.green],
  ['/buyer-dashboard', pagePastel.red],
  ['/orders', pagePastel.gold],
  ['/active-orders', pagePastel.green],
  ['/admin-dashboard', pagePastel.purple],
  ['/admin-monitor', pagePastel.purple],
  ['/admin-payout-review', pagePastel.purple],
  ['/admin-metro-caps', Colors.gray[50]],
  ['/panic-dashboard', pagePastel.red],
  ['/profile', pagePastel.gold],
  ['/reviews-dashboard', pagePastel.green],
  ['/promotions', pagePastel.green],
  ['/area-offers', pagePastel.green],
  ['/charitable-gifts', pagePastel.green],
  ['/finance', pagePastel.green],
  ['/payout-responsibility', pagePastel.green],
  ['/checkout', pagePastel.green],
  ['/combined-checkout', Colors.gray[50]],
  ['/notifications-bell', pagePastel.yellow],
  ['/meal-details', pagePastel.red],
];

function matches(path: string, prefix: string) {
  if (prefix === '/') return path === '/';
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function pageFillForPath(path: string) {
  const value = path.split('?')[0] || '/';
  if (HONEY.some((prefix) => matches(value, prefix))) {
    return { color: AuthColors.gradientBottom, image: authGradientCss };
  }
  const match = PAGE_COLOR.find(([prefix]) => matches(value, prefix));
  return { color: match ? match[1] : Colors.white, image: 'none' };
}

const FILL_STYLE_ID = 'hcp-page-fill';

const FILL_CSS = `
html, body, #root {
  min-height: 100%;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
}
`;

function ensureFillStyle() {
  if (document.getElementById(FILL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FILL_STYLE_ID;
  style.textContent = FILL_CSS;
  document.head.appendChild(style);
}

export function applyPageFill(path: string) {
  if (typeof document === 'undefined') return;
  ensureFillStyle();
  const fill = pageFillForPath(path);
  for (const el of [document.documentElement, document.body]) {
    el.style.backgroundColor = fill.color;
    el.style.backgroundImage = fill.image;
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundAttachment = 'fixed';
    el.style.backgroundSize = '100% 100%';
  }
}
