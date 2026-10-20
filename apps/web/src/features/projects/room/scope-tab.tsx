'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { ProposeScopeSheet } from './propose-scope-sheet';
import { ScopeChangeCard } from './scope-change-card';
import { useProject, useProjectTasks } from './use-project-room';
import { useScopeChanges } from './use-scope-changes';

const CLOSED = new Set(['done', 'cancelled']);

/** Changes to the agreed plan: preview, propose, decide. History stays visible. */
export function ScopeTab({ projectId }: { readonly projectId: string }) {
  const { user, can } = useSession();
  const today = todayIn(user.timeZone);
  const project = useProject(projectId).data;
  const tasks = useProjectTasks(projectId);
  const changes = useScopeChanges(projectId);
  const [proposing, setProposing] = useState(false);
  const canPropose = project?.viewerCanManage ?? false;
  const canDecide = can('scope_changes.approve');
  const movable = (tasks.data?.items ?? []).filter(
    (task) => !CLOSED.has(task.status) && task.dueDate !== null,
  );

  return (
    <div className="flex flex-col gap-5">
      {canPropose && (
        <div className="flex items-center justify-between gap-3">
          <p className="max-w-xl type-body-sm text-ink-muted">
            When the client changes the brief or something slips, propose the new dates here.
            Approval applies them and keeps the old ones in history.
          </p>
          <Button
            variant="secondary"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => setProposing(true)}
            disabled={movable.length === 0}
          >
            Propose a change
          </Button>
        </div>
      )}
      {changes.isPending && (
        <SkeletonGroup label="Loading scope changes">
          <SkeletonText lines={6} />
        </SkeletonGroup>
      )}
      {changes.isError && (
        <ErrorState
          {...describeError(changes.error, { resource: 'collection' })}
          onRetry={() => changes.refetch()}
        />
      )}
      {changes.data && changes.data.length === 0 && (
        <EmptyState
          drawing="plan"
          title="The plan hasn’t changed"
          description="Scope changes appear here with the dates they move and who decided."
        />
      )}
      {changes.data && changes.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {changes.data.map((change) => (
            <ScopeChangeCard key={change.id} change={change} today={today} canDecide={canDecide} />
          ))}
        </div>
      )}
      {canPropose && (
        <ProposeScopeSheet
          projectId={projectId}
          tasks={movable}
          today={today}
          open={proposing}
          onOpenChange={setProposing}
        />
      )}
    </div>
  );
}
