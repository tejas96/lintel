import { calendarDateInTimeZone } from '@lintel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { queryKeys } from '@/api/query-keys';
import { AccountButton } from '@/components/account-button';
import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { PageHeader, ScreenScroll } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { haptics } from '@/feedback/haptics';
import { formatLongDate } from '@/formatting/dates';
import { useProjects } from '@/queries/project-queries';
import { useCurrentUser } from '@/session/session-provider';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { ProjectSiteUpdates } from './project-site-updates';

/** For site supervisors: pick the site, post photos and notes, see what was logged. */
export function SiteScreen() {
  const user = useCurrentUser();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const projects = useProjects('');
  const items = projects.data?.pages.flatMap((page) => page.items) ?? [];
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selected = items.find((project) => project.id === chosenId) ?? items[0] ?? null;
  const today = calendarDateInTimeZone(new Date(), user.timeZone);

  return (
    <ScreenScroll
      edge="tab"
      onRefresh={async () => {
        await projects.refetch();
        if (selected)
          await queryClient.invalidateQueries({ queryKey: queryKeys.siteUpdates(selected.id) });
      }}
    >
      <PageHeader overline={formatLongDate(today)} title="Site" trailing={<AccountButton />} />
      {projects.isPending ? <SkeletonList count={2} label="Loading your sites" /> : null}
      {projects.isError ? (
        <ErrorState
          error={projects.error}
          subject="your sites"
          onRetry={() => void projects.refetch()}
        />
      ) : null}
      {projects.isSuccess && items.length === 0 ? (
        <EmptyState
          icon="site"
          title="No active sites"
          message="When you’re added to a project, its site log will appear here."
        />
      ) : null}
      {items.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {items.map((project) => {
            const active = project.id === selected?.id;
            return (
              <PressableScale
                key={project.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${project.name}, ${project.reference}`}
                onPress={() => {
                  haptics.selection();
                  setChosenId(project.id);
                }}
                style={[
                  styles.chip,
                  active
                    ? {
                        backgroundColor: theme.colors.textPrimary,
                        borderColor: theme.colors.textPrimary,
                      }
                    : {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.borderSubtle,
                      },
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: projectSwatch(theme, project.colorIndex) },
                  ]}
                />
                <AppText
                  variant="label"
                  color={active ? theme.colors.canvas : theme.colors.textPrimary}
                >
                  {project.name}
                </AppText>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}
      {selected ? (
        <View style={styles.selected}>
          <View>
            <AppText variant="titleLg">{selected.name}</AppText>
            <AppText variant="bodySm" tone="secondary">
              {selected.reference} · {selected.clientName}
            </AppText>
          </View>
          <ProjectSiteUpdates projectId={selected.id} limit={20} showHeader={false} />
        </View>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  chips: { gap: SPACE.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  selected: { gap: SPACE.lg },
});
