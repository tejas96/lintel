import type { workflowDefinitionSchema } from '@lintel/api-contracts';
import type { TemplateStage, TemplateTask, WorkflowTemplateDefinition } from '@lintel/domain';
import type { z } from 'zod';

type DefinitionBody = z.infer<typeof workflowDefinitionSchema>;
type StageBody = DefinitionBody['stages'][number];
type TaskBody = StageBody['tasks'][number];

function toTask(task: TaskBody): TemplateTask {
  const {
    description,
    milestoneKey,
    estimateMinutes,
    reviewerRole,
    escalateAfterOverdueDays,
    subtasks,
    ...required
  } = task;
  return {
    ...required,
    ...(description !== undefined ? { description } : {}),
    ...(milestoneKey !== undefined ? { milestoneKey } : {}),
    ...(estimateMinutes !== undefined ? { estimateMinutes } : {}),
    ...(reviewerRole !== undefined ? { reviewerRole } : {}),
    ...(escalateAfterOverdueDays !== undefined ? { escalateAfterOverdueDays } : {}),
    ...(subtasks !== undefined
      ? {
          subtasks: subtasks.map((subtask) => ({
            title: subtask.title,
            ...(subtask.estimateMinutes !== undefined
              ? { estimateMinutes: subtask.estimateMinutes }
              : {}),
          })),
        }
      : {}),
  };
}

function toStage(stage: StageBody): TemplateStage {
  return {
    key: stage.key,
    name: stage.name,
    ...(stage.description !== undefined ? { description: stage.description } : {}),
    ...(stage.requiresOptions !== undefined ? { requiresOptions: stage.requiresOptions } : {}),
    milestones: stage.milestones,
    tasks: stage.tasks.map(toTask),
  };
}

/** Validated request JSON → the domain document (optional fields omitted, never `undefined`). */
export function toWorkflowDefinition(body: DefinitionBody): WorkflowTemplateDefinition {
  return { options: body.options, stages: body.stages.map(toStage) };
}
