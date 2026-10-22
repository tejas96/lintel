import type { TaskDetail } from '@lintel/api-contracts';
import { Avatar, PriorityMarker } from '@lintel/design-system/web';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { daysBetween, describeDue, formatCalendarDate } from '@/lib/format/dates';
import { describeTaskDue, formatTimeOfDay } from '@/lib/format/task-due';
import { ProjectChip, TaskNumber, TaskStatusPill } from '../task-presentation';

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-body-sm text-ink-faint">{label}</dt>
      <dd className="flex min-h-7 items-center gap-2 type-body-sm text-ink">{children}</dd>
    </div>
  );
}

/** "Due tomorrow", "2 days late", "Was due today": only near deadlines, never the date again. */
function relativeDue(dueDate: string, today: string, late: boolean): string {
  return late && dueDate === today ? 'Was due today' : describeDue(dueDate, today).text;
}

/** Where the task sits, who owns it and when it is due. */
export function TaskFacts({ task, today }: { readonly task: TaskDetail; readonly today: string }) {
  const due = describeTaskDue(task, today);
  const moved = task.dueDate && task.baselineDueDate && task.dueDate !== task.baselineDueDate;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <Fact label="Status">
        <TaskStatusPill status={task.status} />
      </Fact>
      <Fact label="Priority">
        <PriorityMarker priority={task.priority} />
      </Fact>
      <Fact label="Due">
        {task.dueDate && due ? (
          <span className="flex flex-col">
            <span className={due.late ? 'font-medium text-overdue' : undefined}>
              {formatCalendarDate(task.dueDate, today)}
              {task.dueTime ? `, ${formatTimeOfDay(task.dueTime)}` : ''}
            </span>
            {daysBetween(today, task.dueDate) < 7 && (
              <span className={due.late ? 'text-overdue' : 'text-ink-faint'}>
                {relativeDue(task.dueDate, today, due.late)}
              </span>
            )}
            {moved && task.baselineDueDate && (
              <span className="text-ink-faint">
                Planned {formatCalendarDate(task.baselineDueDate, today)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-faint">No due date</span>
        )}
      </Fact>
      <Fact label="Owner">
        {task.owner ? (
          <>
            <Avatar name={task.owner.fullName} hue={task.owner.avatarHue} size="xs" decorative />
            <span className="truncate">{task.owner.fullName}</span>
          </>
        ) : (
          <span className="text-ink-faint">Not assigned</span>
        )}
      </Fact>
      <Fact label="Reviewer">
        {task.reviewer ? (
          <>
            <Avatar
              name={task.reviewer.fullName}
              hue={task.reviewer.avatarHue}
              size="xs"
              decorative
            />
            <span className="truncate">{task.reviewer.fullName}</span>
          </>
        ) : (
          <span className="text-ink-faint">
            {task.requiresReview ? 'Not chosen yet' : 'No review needed'}
          </span>
        )}
      </Fact>
      {task.milestone && (
        <Fact label="Milestone">
          <span className="truncate">
            {task.milestone.name}, {formatCalendarDate(task.milestone.dueDate, today)}
          </span>
        </Fact>
      )}
    </dl>
  );
}

/** Number, project and stage above the serif title. */
export function TaskTitleBlock({ task }: { readonly task: TaskDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <TaskNumber value={task.number} />
      <Link
        href={`/projects/${task.project.id}`}
        className="relative z-[1] rounded-sm hover:underline"
      >
        <ProjectChip project={task.project} />
      </Link>
      {task.stage && <span className="type-body-sm text-ink-faint">{task.stage.name}</span>}
      {task.parentTask && (
        <Link
          href={`/tasks/${task.parentTask.id}`}
          className="type-body-sm text-ink-muted hover:underline"
        >
          Part of “{task.parentTask.title}”
        </Link>
      )}
    </div>
  );
}
