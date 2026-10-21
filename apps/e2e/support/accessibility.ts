import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** WCAG 2.2 A and AA, as axe-core tags them. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const BLOCKING: ReadonlySet<string> = new Set(['serious', 'critical']);

/**
 * Runs axe on the page as it is now. Serious and critical violations fail the
 * test (with the rule, the elements and the fix in the message); minor and
 * moderate ones are attached to the report for follow-up.
 */
export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  screen: string,
): Promise<void> {
  // Entrance fades would otherwise be measured half-way (false contrast failures).
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState !== 'running'),
    undefined,
    { timeout: 5_000 },
  );
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
  const minor = results.violations.filter((violation) => !BLOCKING.has(violation.impact ?? ''));
  if (minor.length > 0) {
    await testInfo.attach(`axe-minor-${screen}`, {
      body: JSON.stringify(minor, null, 2),
      contentType: 'application/json',
    });
  }
  const summary = blocking.map((violation) => {
    const targets = violation.nodes.map((node) => node.target.join(' ')).slice(0, 5);
    return `${violation.impact} ${violation.id}: ${violation.help} (${violation.helpUrl})\n    ${targets.join('\n    ')}`;
  });
  expect(summary, `Accessibility problems on ${screen}`).toEqual([]);
}
