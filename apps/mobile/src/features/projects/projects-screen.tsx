import type { ProjectSummary } from '@lintel/api-contracts';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { AccountButton } from '@/components/account-button';
import { PageHeader } from '@/components/screen';
import { SearchField, useDebouncedValue } from '@/components/search-field';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { TabList } from '@/components/tab-list';
import { pluralize } from '@/formatting/quantities';
import { useProjects } from '@/queries/project-queries';
import { useAppTheme } from '@/theme/app-theme';
import { listEntrance } from '@/theme/motion';
import { ProjectCard } from './project-card';

/** Open projects the person can see, soonest finishing first. */
export function ProjectsScreen() {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim());
  const projects = useProjects(query);
  const items = projects.data?.pages.flatMap((page) => page.items) ?? [];
  const total = projects.data?.pages[0]?.totalItems;

  const placeholder = projects.isPending ? (
    <SkeletonList count={3} label="Loading projects" />
  ) : projects.isError ? (
    <ErrorState error={projects.error} subject="projects" onRetry={() => void projects.refetch()} />
  ) : query ? (
    <EmptyState icon="search" title="No matches" message={`No open project matches “${query}”.`} />
  ) : (
    <EmptyState
      icon="projects"
      title="No projects yet"
      message="Projects you manage or work on will appear here once your studio adds them."
    />
  );

  return (
    <TabList<ProjectSummary>
      data={items}
      keyExtractor={(project) => project.id}
      renderItem={({ item, index }) => (
        <Animated.View entering={listEntrance(index)}>
          <ProjectCard project={item} />
        </Animated.View>
      )}
      header={
        <>
          <PageHeader
            overline={total === undefined ? 'Studio work' : `${pluralize(total, 'open project')}`}
            title="Projects"
            trailing={<AccountButton />}
          />
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects or clients"
          />
        </>
      }
      placeholder={placeholder}
      onRefresh={() => projects.refetch()}
      onEndReached={() => {
        if (projects.hasNextPage && !projects.isFetchingNextPage) void projects.fetchNextPage();
      }}
      footer={projects.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : null}
    />
  );
}
