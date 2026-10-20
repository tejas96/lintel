import { NativeTabs } from 'expo-router/native-tabs';
import { useApprovalCount } from '@/queries/approval-queries';
import { useUnreadNotificationCount } from '@/queries/notification-queries';
import { visibleTabs } from '@/session/capabilities';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { fontFaceFor } from '@/theme/fonts';

function badgeText(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}

/**
 * Native tab bar (Liquid Glass on iOS 26, Material 3 on Android). Which tabs
 * appear follows the person's capabilities.
 */
export default function TabsLayout() {
  const user = useCurrentUser();
  const tabs = visibleTabs(user);
  const { colors } = useAppTheme();
  const unread = badgeText(useUnreadNotificationCount());
  const approvals = badgeText(useApprovalCount(tabs.has('approvals')));
  return (
    <NativeTabs
      tintColor={colors.accent}
      labelStyle={{ fontFamily: fontFaceFor('ui', 500) }}
      backgroundColor={colors.surface}
      indicatorColor={colors.accentSoft}
      badgeBackgroundColor={colors.accent}
      minimizeBehavior="onScrollDown"
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="site" disableAutomaticContentInsets hidden={!tabs.has('site')}>
        <NativeTabs.Trigger.Label>Site</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'hammer', selected: 'hammer.fill' }}
          md="construction"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.stack.3d.up', selected: 'square.stack.3d.up.fill' }}
          md="architecture"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="approvals"
        disableAutomaticContentInsets
        hidden={!tabs.has('approvals')}
      >
        <NativeTabs.Trigger.Label>Approvals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.seal', selected: 'checkmark.seal.fill' }}
          md="approval"
        />
        <NativeTabs.Trigger.Badge hidden={!approvals}>{approvals ?? ''}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leave" disableAutomaticContentInsets hidden={!tabs.has('leave')}>
        <NativeTabs.Trigger.Label>Leave</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }}
          md="beach_access"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        <NativeTabs.Trigger.Badge hidden={!unread}>{unread ?? ''}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
