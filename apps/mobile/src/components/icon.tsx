import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type SymbolName = Extract<SymbolViewProps['name'], { ios?: unknown }>;

/**
 * One vocabulary of icons: SF Symbols on iOS, Material Symbols on Android.
 * Names describe meaning, not shape, so screens never pick platform glyphs.
 */
const ICONS = {
  add: { ios: 'plus', android: 'add' },
  approvals: { ios: 'checkmark.seal', android: 'approval' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward' },
  attachment: { ios: 'paperclip', android: 'attach_file' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  blocked: { ios: 'hand.raised', android: 'block' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  camera: { ios: 'camera', android: 'photo_camera' },
  challenge: { ios: 'exclamationmark.bubble', android: 'feedback' },
  checkboxOff: { ios: 'circle', android: 'radio_button_unchecked' },
  checkboxOn: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  checklist: { ios: 'checklist', android: 'checklist' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  comment: { ios: 'text.bubble', android: 'comment' },
  dependency: { ios: 'link', android: 'link' },
  device: { ios: 'iphone', android: 'smartphone' },
  document: { ios: 'doc.text', android: 'description' },
  done: { ios: 'checkmark.circle', android: 'task_alt' },
  edit: { ios: 'pencil', android: 'edit' },
  error: { ios: 'exclamationmark.triangle', android: 'warning' },
  flag: { ios: 'flag', android: 'flag' },
  inbox: { ios: 'tray', android: 'inbox' },
  info: { ios: 'info.circle', android: 'info' },
  leave: { ios: 'sun.horizon', android: 'beach_access' },
  lock: { ios: 'lock', android: 'lock' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  notMet: { ios: 'minus.circle', android: 'do_not_disturb_on' },
  notifications: { ios: 'bell', android: 'notifications' },
  notificationsOff: { ios: 'bell.slash', android: 'notifications_off' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  openExternal: { ios: 'arrow.up.right', android: 'north_east' },
  pause: { ios: 'pause.fill', android: 'pause' },
  pending: { ios: 'hourglass', android: 'hourglass_empty' },
  person: { ios: 'person.crop.circle', android: 'account_circle' },
  photo: { ios: 'photo.on.rectangle', android: 'photo_library' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  projects: { ios: 'square.stack.3d.up', android: 'architecture' },
  quietHours: { ios: 'moon', android: 'bedtime' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  review: { ios: 'eye', android: 'rate_review' },
  reward: { ios: 'rosette', android: 'workspace_premium' },
  search: { ios: 'magnifyingglass', android: 'search' },
  send: { ios: 'arrow.up.circle.fill', android: 'send' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  site: { ios: 'hammer', android: 'construction' },
  today: { ios: 'sun.max', android: 'today' },
  upload: { ios: 'arrow.up.doc', android: 'upload' },
  waiting: { ios: 'clock', android: 'schedule' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color: ColorValue;
  readonly weight?: 'regular' | 'medium' | 'semibold';
  readonly style?: StyleProp<ViewStyle>;
}

/** Decorative by default: pair icons with a visible word or an accessibility label. */
export function Icon({ name, size = 20, color, weight = 'regular', style }: IconProps) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      weight={weight}
      style={[{ width: size, height: size }, style]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

export function iconSymbol(name: IconName): SymbolName {
  return ICONS[name];
}
