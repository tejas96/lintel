'use client';

import { Button } from '@lintel/design-system/web';
import { CircleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import type { TemplateIssue } from '../template-issues';
import { allTasks, type WorkflowDefinition } from '../template-types';

interface IssuesPanelProps {
  readonly issues: readonly TemplateIssue[];
  readonly definition: WorkflowDefinition;
  readonly onGoToStage: (stageIndex: number) => void;
  readonly onGoToTask: (stageIndex: number, taskKey: string) => void;
}

/** Everything the server refused in the last save, each with a way to get to it. */
export function IssuesPanel({ issues, definition, onGoToStage, onGoToTask }: IssuesPanelProps) {
  if (issues.length === 0) return null;
  const tasks = allTasks(definition);
  const locate = (issue: TemplateIssue) => {
    const { target } = issue;
    if (target.kind === 'task') {
      const place = tasks.find((entry) => entry.task.key === target.taskKey);
      return place
        ? {
            label: `${place.task.title}, ${place.stage.name}`,
            go: () => onGoToTask(place.stageIndex, place.task.key),
          }
        : null;
    }
    if (target.kind === 'stage') {
      const index = definition.stages.findIndex((stage) => stage.key === target.stageKey);
      const stage = definition.stages[index];
      return stage ? { label: stage.name, go: () => onGoToStage(index) } : null;
    }
    if (target.kind === 'milestone') {
      const index = definition.stages.findIndex((stage) =>
        stage.milestones.some((milestone) => milestone.key === target.milestoneKey),
      );
      const stage = definition.stages[index];
      return stage ? { label: `Milestone in ${stage.name}`, go: () => onGoToStage(index) } : null;
    }
    return null;
  };
  return (
    <motion.section
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-lg border border-overdue-solid/30 bg-overdue-tint/40 p-4"
    >
      <h2 className="flex items-center gap-2 type-title-md text-ink">
        <CircleAlert aria-hidden className="size-4 text-overdue" />
        {issues.length === 1
          ? 'One thing to fix before saving'
          : `${issues.length} things to fix before saving`}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {issues.map((issue) => {
          const place = locate(issue);
          return (
            <li
              key={`${issue.message}-${JSON.stringify(issue.target)}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm"
            >
              <span className="text-ink">{issue.message}</span>
              {place && (
                <Button
                  size="sm"
                  variant="quiet"
                  className="h-7 px-2 text-accent"
                  onClick={place.go}
                >
                  Go to {place.label}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
