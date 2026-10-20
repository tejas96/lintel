/** Radius in px. Nested radius rule: inner = outer − inset. */
export const RADIUS = { xs: 6, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, full: 999 } as const;

/** 4px base spacing scale. */
export const SPACING = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;

/** Light-theme shadows (ink 30,28,25). Dark theme uses rgba(0,0,0,.5) and raised surfaces. */
export const ELEVATION = {
  e0: 'none',
  e1: '0 1px 2px rgba(30,28,25,.06), 0 1px 1px rgba(30,28,25,.04)',
  e2: '0 2px 4px rgba(30,28,25,.05), 0 12px 24px -12px rgba(30,28,25,.16)',
  e3: '0 4px 8px rgba(30,28,25,.06), 0 24px 48px -16px rgba(30,28,25,.24)',
  e4: '0 32px 80px -24px rgba(30,28,25,.36)',
} as const;

/** Dark-theme shadows: deeper and black, because dark surfaces lift by tone, not by shade. */
export const DARK_ELEVATION: Readonly<Record<keyof typeof ELEVATION, string>> = {
  e0: 'none',
  e1: '0 1px 2px rgba(0,0,0,.40)',
  e2: '0 2px 4px rgba(0,0,0,.30), 0 12px 24px -12px rgba(0,0,0,.50)',
  e3: '0 4px 8px rgba(0,0,0,.30), 0 24px 48px -16px rgba(0,0,0,.60)',
  e4: '0 32px 80px -24px rgba(0,0,0,.70)',
};

export const MIN_TOUCH_TARGET = 44;

/** Responsive breakpoints in px (sidebar ↔ bottom bar switches at `md`). */
export const BREAKPOINTS = { sm: 640, md: 900, lg: 1200, xl: 1440 } as const;
