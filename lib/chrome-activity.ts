/** Floating back arrows and jump chevrons. 25% under the old 44px chip. */
export const CHROME_CHIP_SIZE = 33;
export const CHROME_ICON_SIZE = 17;
/** Original header glass was white at 0.18. This is that same frost, darkened so the circle reads on a bright header. */
export const CHROME_FROST_TINT = 'rgba(90, 48, 18, 0.34)';
export const CHROME_IDLE_MS = 5000;

type Listener = (visible: boolean) => void;

const listeners = new Set<Listener>();
let visible = true;
let timer: ReturnType<typeof setTimeout> | null = null;
let armed = false;

function emit() {
  listeners.forEach((listener) => listener(visible));
}

export function chromeIsVisible(): boolean {
  return visible;
}

/** Show the chips and hide them again after 5 seconds without a new poke. */
export function pokeChromeActivity() {
  armed = true;
  if (!visible) {
    visible = true;
    emit();
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    visible = false;
    timer = null;
    emit();
  }, CHROME_IDLE_MS);
}

export function subscribeChromeVisible(listener: Listener): () => void {
  listeners.add(listener);
  if (!armed) pokeChromeActivity();
  else listener(visible);
  return () => {
    listeners.delete(listener);
  };
}
