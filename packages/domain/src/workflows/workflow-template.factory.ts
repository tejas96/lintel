import type { ProjectType } from '../projects/project-status';
import { ARCHITECTURE_STAGES } from './presets/architecture.stages';
import {
  PROCUREMENT_STAGE,
  PROJECT_HANDOVER_STAGE,
  SITE_EXECUTION_STAGE,
} from './presets/execution.stages';
import {
  CONCEPT_STAGE,
  DESIGN_DEVELOPMENT_STAGE,
  DESIGN_HANDOVER_STAGE,
  DISCOVERY_STAGE,
} from './presets/interior-design.stages';
import type { TemplateOption, WorkflowTemplateDefinition } from './workflow-template-definition';

export interface WorkflowTemplatePreset {
  readonly name: string;
  readonly description: string;
  readonly projectType: ProjectType;
  readonly definition: WorkflowTemplateDefinition;
}

function executionOption(enabledByDefault: boolean): TemplateOption {
  return {
    key: 'includes_execution',
    label: 'The studio also executes the work on site',
    enabledByDefault,
  };
}

const DESIGN_STAGES = [
  DISCOVERY_STAGE,
  CONCEPT_STAGE,
  DESIGN_DEVELOPMENT_STAGE,
  DESIGN_HANDOVER_STAGE,
];
const EXECUTION_STAGES = [PROCUREMENT_STAGE, SITE_EXECUTION_STAGE, PROJECT_HANDOVER_STAGE];

/**
 * Creates the starter template for a project type (Factory pattern). Studios
 * copy a preset into their own template and change it freely afterwards.
 */
export function createWorkflowTemplatePreset(projectType: ProjectType): WorkflowTemplatePreset {
  switch (projectType) {
    case 'residential_interior':
      return {
        projectType,
        name: 'Residential interiors',
        description: 'Homes and apartments: brief, concept, detailed design and drawings.',
        definition: {
          options: [executionOption(false)],
          stages: [...DESIGN_STAGES, ...EXECUTION_STAGES],
        },
      };
    case 'commercial_interior':
      return {
        projectType,
        name: 'Commercial interiors',
        description: 'Offices, retail and hospitality fit-outs with landlord coordination.',
        definition: {
          options: [executionOption(false)],
          stages: [...DESIGN_STAGES, ...EXECUTION_STAGES],
        },
      };
    case 'architecture':
      return {
        projectType,
        name: 'Architecture',
        description:
          'Feasibility, schematic design, statutory approvals and construction documents.',
        definition: { options: [], stages: ARCHITECTURE_STAGES },
      };
    case 'interior_and_execution':
      return {
        projectType,
        name: 'Interior design + execution',
        description: 'Full design followed by procurement, site work, snagging and handover.',
        definition: {
          options: [executionOption(true)],
          stages: [...DESIGN_STAGES, ...EXECUTION_STAGES],
        },
      };
    case 'turnkey':
      return {
        projectType,
        name: 'Turnkey',
        description: 'One accountable team from first brief to keys in hand.',
        definition: {
          options: [executionOption(true)],
          stages: [...DESIGN_STAGES, ...EXECUTION_STAGES],
        },
      };
    case 'other':
      return {
        projectType,
        name: 'Simple project',
        description: 'A light brief → design → handover flow for small engagements.',
        definition: { options: [], stages: [DISCOVERY_STAGE, CONCEPT_STAGE] },
      };
  }
}
