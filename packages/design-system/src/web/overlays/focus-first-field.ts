/** Text-like fields worth typing into straight away (not buttons, not checkboxes). */
const FIELD_SELECTOR = [
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=search]):not([disabled])',
  'textarea:not([disabled])',
].join(', ');

/**
 * For Radix `onOpenAutoFocus`: when an overlay holds a form, put the cursor in
 * its first field instead of on the Close button. Overlays without fields keep
 * Radix's default (the first focusable element).
 */
export function focusFirstField(event: Event): void {
  const container = event.currentTarget;
  if (!(container instanceof HTMLElement)) return;
  const field = container.querySelector<HTMLElement>(FIELD_SELECTOR);
  if (!field) return;
  event.preventDefault();
  field.focus({ preventScroll: true });
}
