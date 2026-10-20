import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { isNotFound } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { useSiteUpdates } from '@/queries/project-queries';
import { can } from '@/session/capabilities';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { SiteUpdateCard } from './site-update-card';

/** Recent site updates for one project, with "Post an update" for people who may. */
export function ProjectSiteUpdates({
  projectId,
  limit = 3,
  showHeader = true,
}: {
  readonly projectId: string;
  readonly limit?: number;
  readonly showHeader?: boolean;
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const updates = useSiteUpdates(projectId);
  const canPost = can(user, 'site_updates.create');
  // Until the server offers site updates, the section stays out of the way.
  if (updates.isError && isNotFound(updates.error) && !canPost) return null;
  const list = (updates.data ?? []).slice(0, limit);
  const body = (
    <View style={{ gap: SPACE.md }}>
      {updates.isPending ? <SkeletonList count={1} /> : null}
      {updates.isError && !isNotFound(updates.error) ? (
        <InlineError error={updates.error} onRetry={() => void updates.refetch()} />
      ) : null}
      {updates.isSuccess && list.length === 0 ? (
        <AppText variant="bodySm" tone="secondary">
          No site updates yet.
        </AppText>
      ) : null}
      {list.map((update) => (
        <SiteUpdateCard key={update.id} update={update} />
      ))}
      {canPost ? (
        <Button
          label="Post a site update"
          icon="camera"
          variant={showHeader ? 'secondary' : 'primary'}
          size={showHeader ? 'md' : 'lg'}
          onPress={() => router.push({ pathname: '/site-updates/new', params: { projectId } })}
        />
      ) : null}
    </View>
  );
  if (!showHeader) return body;
  return (
    <Section title="From site" meta={updates.data ? String(updates.data.length) : undefined}>
      {body}
    </Section>
  );
}
