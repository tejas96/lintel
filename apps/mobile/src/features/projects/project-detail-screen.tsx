import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { isNotFound } from '@/api/api-error';
import { queryKeys } from '@/api/query-keys';
import { ScreenScroll } from '@/components/screen';
import { Section } from '@/components/section';
import { SkeletonBlock, SkeletonGroup, SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { ProjectSiteUpdates } from '@/features/site-updates/project-site-updates';
import { DeliverableRow } from '@/features/tasks/deliverables-section';
import { useProject, useProjectDeliverables } from '@/queries/project-queries';
import { SPACE } from '@/theme/layout';
import { MilestoneList } from './milestone-list';
import { ProjectHeader } from './project-header';
import { ProjectHealthCard } from './project-health-card';
import { StageList } from './stage-list';

function ProjectDeliverables({ projectId }: { readonly projectId: string }) {
  const deliverables = useProjectDeliverables(projectId);
  if (deliverables.isError && isNotFound(deliverables.error)) return null;
  const list = deliverables.data ?? [];
  if (list.length === 0) return null;
  return (
    <Section title="Deliverables" meta={String(list.length)}>
      {list.map((deliverable) => (
        <DeliverableRow key={deliverable.id} deliverable={deliverable} />
      ))}
    </Section>
  );
}

/** Project summary: health first, then the workflow, milestones, deliverables and site. */
export function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const queryClient = useQueryClient();
  return (
    <>
      <Stack.Screen options={{ title: project.data?.reference ?? '' }} />
      <ScreenScroll
        edge="stack"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.project(id) })}
      >
        {project.isPending ? (
          <SkeletonGroup label="Loading project">
            <View style={{ gap: SPACE.md }}>
              <SkeletonBlock width="45%" height={12} />
              <SkeletonBlock height={32} />
              <SkeletonBlock height={140} radius={16} />
            </View>
          </SkeletonGroup>
        ) : null}
        {project.isPending ? <SkeletonList count={2} /> : null}
        {project.isError ? (
          <ErrorState
            error={project.error}
            subject="this project"
            onRetry={() => void project.refetch()}
          />
        ) : null}
        {project.data ? (
          <>
            <ProjectHeader project={project.data} />
            <ProjectHealthCard project={project.data} />
            <Section title="Workflow">
              <StageList stages={project.data.stages} />
            </Section>
            <MilestoneList milestones={project.data.milestones} stages={project.data.stages} />
            <ProjectDeliverables projectId={project.data.id} />
            <ProjectSiteUpdates projectId={project.data.id} />
          </>
        ) : null}
      </ScreenScroll>
    </>
  );
}
