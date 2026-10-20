import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { ListRow } from '@/components/list-row';
import { Divider } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, InlineError } from '@/components/state-views';
import { useProjects } from '@/queries/project-queries';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

/** Pick which project an update is for (the person's open projects). */
export function ProjectChooser({ onChoose }: { readonly onChoose: (projectId: string) => void }) {
  const theme = useAppTheme();
  const projects = useProjects('');
  const items = projects.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <View style={{ gap: SPACE.md }}>
      <AppText variant="titleLg">Which project?</AppText>
      {projects.isPending ? <SkeletonList count={2} /> : null}
      {projects.isError ? (
        <InlineError error={projects.error} onRetry={() => void projects.refetch()} />
      ) : null}
      {projects.isSuccess && items.length === 0 ? (
        <EmptyState
          icon="projects"
          title="No open projects"
          message="You’re not on any open project yet."
        />
      ) : null}
      {items.map((project, index) => (
        <View key={project.id}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            title={project.name}
            subtitle={`${project.reference} · ${project.clientName}`}
            leading={
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: projectSwatch(theme, project.colorIndex),
                }}
              />
            }
            onPress={() => onChoose(project.id)}
          />
        </View>
      ))}
    </View>
  );
}
