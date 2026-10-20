/**
 * Any other route closes the drawer. Without this, soft navigation would
 * keep a task drawer open over the next page.
 */
export default function NoDrawer() {
  return null;
}
