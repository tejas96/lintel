import * as Haptics from 'expo-haptics';

function ignoreUnsupported(promise: Promise<void>): void {
  // Haptics are a courtesy: devices without a Taptic Engine simply skip them.
  promise.catch(() => undefined);
}

/** Haptics for key moments only — never on scroll or on every tap. */
export const haptics = {
  /** A choice changed (toggle, segment, checklist tick). */
  selection: () => ignoreUnsupported(Haptics.selectionAsync()),
  /** A primary action was pressed. */
  press: () => ignoreUnsupported(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Swipe crossed its commit threshold. */
  threshold: () => ignoreUnsupported(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () =>
    ignoreUnsupported(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    ignoreUnsupported(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => ignoreUnsupported(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
