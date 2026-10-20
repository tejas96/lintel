import { describe, expect, it } from 'vitest';
import { DARK_COLORS, LIGHT_COLORS } from '../tokens/colors';
import { DURATION } from '../tokens/motion';
import { buildThemeCss } from './build-theme-css';
import { COLOR_CSS_NAMES } from './css-names';

describe('generated theme CSS', () => {
  const css = buildThemeCss();

  it('maps every colour token to a Tailwind colour and both theme values', () => {
    for (const [token, name] of Object.entries(COLOR_CSS_NAMES)) {
      expect(css).toContain(`--color-${name}: var(--lt-${name});`);
      const key = token as keyof typeof LIGHT_COLORS;
      expect(css).toContain(`--lt-${name}: ${LIGHT_COLORS[key]};`);
      expect(css).toContain(`--lt-${name}: ${DARK_COLORS[key]};`);
    }
  });

  it('applies dark values for the OS preference and for an explicit choice', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-theme='light'])");
    expect(css).toContain(":root[data-theme='dark']");
  });

  it('collapses movement but keeps fades under reduced or calm motion', () => {
    const calm = css.slice(css.indexOf(":root[data-motion='calm']"));
    expect(calm).toContain('--duration-base: 1ms;');
    expect(calm).toContain(`--duration-fade: ${DURATION.fade}ms;`);
  });

  it('emits one type utility per type style', () => {
    expect(css).toContain('@utility type-display-lg');
    expect(css).toContain('@utility type-body-sm');
  });
});
