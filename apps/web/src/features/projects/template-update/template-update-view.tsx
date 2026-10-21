'use client';

import type { TemplateUpdateStatus } from '@lintel/api-contracts';
import {
  EmptyState,
  ErrorState,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { ApplyPanel, countUpdate } from './apply-panel';
import { EndDateImpact } from './end-date-impact';
import { UpdateHistory } from './update-history';
import { UpdateSections } from './update-sections';
import {
  useApplyTemplateUpdate,
  useTemplateUpdatePreview,
  useTemplateUpdateStatus,
} from './use-template-update';

function Loading() {
  return (
    <SkeletonGroup label="Preparing the preview" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </SkeletonGroup>
  );
}

function noUpdateTitle(status: TemplateUpdateStatus): string {
  if (status.available) return 'Only the project manager can update the template';
  if (status.template)
    return `This project follows the newest version of “${status.template.name}”`;
  return 'This project was not created from a template';
}

/** Nothing to apply (or not this person's call), with the earlier updates for reference. */
function NoUpdate({
  status,
  today,
}: {
  readonly status: TemplateUpdateStatus;
  readonly today: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <EmptyState
        drawing="lintelRaising"
        title={noUpdateTitle(status)}
        description={
          status.current
            ? `Version ${status.current.versionNumber} is the one it follows. When a newer version is published, the project manager can preview and apply it here.`
            : 'Its stages and tasks are managed directly in the project.'
        }
      />
      <UpdateHistory history={status.history} today={today} />
    </div>
  );
}

/**
 * "Update to template vX": a dry run of what moving this project to the
 * newer version would add, change and remove, what stays as it is and why,
 * then one decision. Nothing is saved until the manager applies it.
 */
export function TemplateUpdateView({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const router = useRouter();
  const status = useTemplateUpdateStatus(projectId);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [extend, setExtend] = useState(false);
  const canUpdate = status.data?.viewerCanUpdate ?? false;
  const targetId = canUpdate ? (status.data?.available?.id ?? null) : null;
  const preview = useTemplateUpdatePreview(projectId, targetId, [...ticked]);
  const apply = useApplyTemplateUpdate(projectId);
  const tick = (key: string, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  if (status.isPending || (targetId && preview.isPending)) return <Loading />;
  const failure = status.error ?? preview.error;
  if (failure) {
    return (
      <ErrorState
        {...describeError(failure, { resource: 'item', noun: 'update' })}
        onRetry={() => (status.isError ? status.refetch() : preview.refetch())}
      />
    );
  }
  const data = status.data;
  if (!data) return null;
  if (!data.available || !canUpdate || !preview.data) {
    return <NoUpdate status={data} today={today} />;
  }
  const view = preview.data;
  const counts = countUpdate(view);
  const run = () =>
    apply.mutate(
      {
        targetVersionId: view.to.id,
        ticked: [...ticked],
        extendPlannedEnd: extend,
        version: view.projectVersion,
      },
      { onSuccess: () => router.push(`/projects/${projectId}`) },
    );
  return (
    <motion.div {...pageEnter} className="flex flex-col gap-6">
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="type-overline text-ink-faint">Template update · preview</p>
        <h2 className="type-display-md text-balance text-ink">
          Move to “{view.template.name}” version {view.to.versionNumber}
        </h2>
        <p className="type-body text-ink-muted">
          This project follows version {view.from.versionNumber}. Below is everything the update
          would do. Nothing is saved until you apply it, and it is recorded in the activity and
          schedule history.
        </p>
        {view.to.changeNotes && (
          <blockquote className="border-l-2 border-accent/40 pl-3 type-body-sm text-ink">
            {view.to.changeNotes}
          </blockquote>
        )}
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div aria-busy={preview.isFetching || undefined} className="min-w-0">
          <UpdateSections items={view.items} today={today} ticked={ticked} onTick={tick} />
        </div>
        <aside aria-label="Decision" className="flex flex-col gap-4 lg:sticky lg:top-6">
          <ApplyPanel
            projectId={projectId}
            preview={view}
            counts={counts}
            pending={apply.isPending}
            onApply={run}
          >
            <EndDateImpact
              plannedEndDate={view.plannedEndDate}
              forecastEndDate={view.forecastEndDate}
              today={today}
              extend={extend}
              onExtendChange={setExtend}
            />
          </ApplyPanel>
          <UpdateHistory history={data.history} today={today} />
        </aside>
      </div>
    </motion.div>
  );
}
