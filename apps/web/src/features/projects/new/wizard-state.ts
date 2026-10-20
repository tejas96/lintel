import { createProjectBodySchema, type TemplateVersion } from '@lintel/api-contracts';
import type { ProjectCriticality, ProjectRole, ProjectType } from '@lintel/domain';
import type { z } from 'zod';

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

export interface WizardState {
  readonly name: string;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly clientEmail: string;
  readonly siteAddress: string;
  readonly projectType: ProjectType;
  readonly criticality: ProjectCriticality;
  readonly description: string;
  /** null = start without a template. */
  readonly templateId: string | null;
  /** The person chose to start without a template (otherwise the type's template is suggested). */
  readonly skipTemplate: boolean;
  readonly templateVersionId: string | null;
  readonly templateOptions: readonly string[];
  readonly plannedStartDate: string | null;
  readonly managerUserId: string | null;
  /** Who does the work for each project role. */
  readonly roleAssignments: Readonly<Partial<Record<ProjectRole, string>>>;
  readonly budgetRupees: string;
}

export const INITIAL_WIZARD_STATE: WizardState = {
  name: '',
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  siteAddress: '',
  projectType: 'residential_interior',
  criticality: 'normal',
  description: '',
  templateId: null,
  skipTemplate: false,
  templateVersionId: null,
  templateOptions: [],
  plannedStartDate: null,
  managerUserId: null,
  roleAssignments: {},
  budgetRupees: '',
};

export const WIZARD_STEPS = ['Basics', 'Workflow', 'Schedule and team', 'Review'] as const;

/** Project roles the chosen template assigns work to (manager is chosen separately). */
export function rolesInTemplate(version: TemplateVersion | undefined): ProjectRole[] {
  if (!version) return [];
  const roles = new Set<ProjectRole>();
  for (const stage of version.definition.stages) {
    for (const task of stage.tasks) {
      roles.add(task.responsibleRole);
      if (task.reviewerRole) roles.add(task.reviewerRole);
    }
  }
  roles.delete('manager');
  return [...roles];
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Builds and validates the request body with the API's own schema. */
export function toCreateBody(
  state: WizardState,
): { ok: true; body: CreateProjectBody } | { ok: false; errors: Readonly<Record<string, string>> } {
  const rupees = state.budgetRupees.replace(/[,\s]/g, '');
  const members = Object.entries(state.roleAssignments).flatMap(([projectRole, userId]) =>
    userId ? [{ userId, projectRole }] : [],
  );
  if (state.managerUserId) members.push({ userId: state.managerUserId, projectRole: 'manager' });
  const parsed = createProjectBodySchema.safeParse({
    name: state.name,
    clientName: state.clientName,
    clientPhone: nullable(state.clientPhone),
    clientEmail: nullable(state.clientEmail),
    siteAddress: nullable(state.siteAddress),
    projectType: state.projectType,
    description: nullable(state.description),
    criticality: state.criticality,
    managerUserId: state.managerUserId ?? '',
    plannedStartDate: state.plannedStartDate ?? '',
    templateVersionId: state.templateVersionId,
    templateOptions: state.templateOptions,
    members,
    budgetMinor: rupees === '' ? null : Math.round(Number(rupees) * 100),
  });
  if (parsed.success) return { ok: true, body: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    if (!errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Which step owns each field, to send the person back to the right place. */
export const FIELD_STEP: Readonly<Record<string, number>> = {
  name: 0,
  clientName: 0,
  clientPhone: 0,
  clientEmail: 0,
  siteAddress: 0,
  description: 0,
  projectType: 0,
  criticality: 0,
  templateVersionId: 1,
  templateOptions: 1,
  managerUserId: 2,
  plannedStartDate: 2,
  members: 2,
  budgetMinor: 2,
};
