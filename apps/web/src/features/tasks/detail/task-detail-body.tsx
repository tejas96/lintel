'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { AvatarStack, Card } from '@lintel/design-system/web';
import { useState } from 'react';
import { TaskDeliverables } from '@/features/deliverables/task-deliverables';
import { ReportBlockerSheet } from '../report-blocker-sheet';
import { DetailSection } from './detail-section';
import { TaskAttachments } from './task-attachments';
import { TaskChecklist } from './task-checklist';
import { ScheduleHistory, TaskComments } from './task-comments';
import { TaskFacts } from './task-header';
import { TaskReassignment } from './task-reassignment';
import { TaskBlockers, TaskDependencies } from './task-relations';
import { TaskTransitions } from './task-transitions';

function Brief({ task }: { readonly task: TaskDetail }) {
  if (!task.description && !task.completionCriteria) return null;
  return (
    <DetailSection title="Brief">
      {task.description && (
        <p className="max-w-prose whitespace-pre-wrap type-body text-ink">{task.description}</p>
      )}
      {task.completionCriteria && (
        <div className="rounded-md border-l-2 border-accent bg-accent-soft/40 px-4 py-3">
          <p className="type-label text-on-accent-soft">Done means</p>
          <p className="mt-1 whitespace-pre-wrap type-body-sm text-ink">
            {task.completionCriteria}
          </p>
        </div>
      )}
    </DetailSection>
  );
}

function Collaborators({ task }: { readonly task: TaskDetail }) {
  if (task.collaborators.length === 0) return null;
  return (
    <DetailSection title="Working with">
      <div className="flex items-center gap-3">
        <AvatarStack people={task.collaborators} max={5} />
        <p className="type-body-sm text-ink-muted">
          {task.collaborators.map((person) => person.fullName).join(', ')}
        </p>
      </div>
    </DetailSection>
  );
}

/**
 * Everything about one task. On a page the record splits into a main column
 * and a side column; in the drawer it is a single column.
 */
export function TaskDetailBody({
  task,
  today,
  layout,
}: {
  readonly task: TaskDetail;
  readonly today: string;
  readonly layout: 'page' | 'drawer';
}) {
  const [blocking, setBlocking] = useState(false);
  const report = () => setBlocking(true);
  const main = (
    <>
      <Brief task={task} />
      <TaskChecklist task={task} />
      <TaskDeliverables task={task} />
      <TaskAttachments task={task} />
      <TaskComments taskId={task.id} />
    </>
  );
  const side = (
    <>
      <TaskBlockers task={task} onReport={report} />
      <TaskReassignment task={task} />
      <TaskDependencies task={task} today={today} />
      <Collaborators task={task} />
      <ScheduleHistory task={task} today={today} />
    </>
  );
  return (
    <>
      {layout === 'drawer' ? (
        <div className="flex flex-col gap-8 p-5 sm:p-6">
          <TaskTransitions task={task} onReportBlocker={report} />
          <TaskFacts task={task} today={today} />
          {side}
          {main}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <TaskTransitions task={task} onReportBlocker={report} />
          <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-10">{main}</div>
            <aside aria-label="Task details" className="flex flex-col gap-8 xl:sticky xl:top-6">
              <Card className="p-5">
                <TaskFacts task={task} today={today} />
              </Card>
              {side}
            </aside>
          </div>
        </div>
      )}
      <ReportBlockerSheet
        task={blocking ? { id: task.id, title: task.title, version: task.version } : null}
        onClose={() => setBlocking(false)}
      />
    </>
  );
}
