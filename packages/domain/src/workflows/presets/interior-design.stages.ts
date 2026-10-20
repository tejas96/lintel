import type { TemplateStage } from '../workflow-template-definition';
import { presetTask } from './preset-helpers';

/** Design stages shared by residential, commercial and execution templates. */
export const DISCOVERY_STAGE: TemplateStage = {
  key: 'discovery',
  name: 'Discovery',
  description: 'Understand the client, the site and the budget.',
  milestones: [{ key: 'brief-signoff', name: 'Brief signed off', requiresClientApproval: true }],
  tasks: [
    presetTask('client-brief', 'Capture the client brief', 'designer', 2, {
      milestone: 'brief-signoff',
      priority: 'high',
      checklist: [
        'Budget range agreed',
        'Household needs and routines noted',
        'Style references collected',
      ],
      deliverables: ['Client brief'],
    }),
    presetTask('site-measurement', 'Measure the site', 'site_supervisor', 1, {
      priority: 'high',
      checklist: [
        'Every room measured',
        'Site photos uploaded',
        'Electrical and plumbing points marked',
      ],
      deliverables: ['Measurement drawing'],
    }),
    presetTask('site-survey-review', 'Review the site survey', 'manager', 1, {
      milestone: 'brief-signoff',
      dependsOn: ['site-measurement'],
      optionalChecklist: ['Structural concerns flagged'],
    }),
  ],
};

export const CONCEPT_STAGE: TemplateStage = {
  key: 'concept',
  name: 'Concept design',
  description: 'Shape the layout and the mood, then present them.',
  milestones: [{ key: 'concept-approval', name: 'Concept approved', requiresClientApproval: true }],
  tasks: [
    presetTask('space-planning', 'Prepare space planning options', 'designer', 4, {
      dependsOn: ['client-brief', 'site-survey-review'],
      reviewBy: 'manager',
      checklist: ['Two layout options prepared', 'Circulation and storage checked'],
      deliverables: ['Space plan'],
    }),
    presetTask('mood-board', 'Build the mood board', 'designer', 3, {
      dependsOn: ['client-brief'],
      reviewBy: 'manager',
      deliverables: ['Mood board'],
    }),
    presetTask('concept-presentation', 'Present the concept to the client', 'manager', 1, {
      milestone: 'concept-approval',
      dependsOn: ['space-planning', 'mood-board'],
      priority: 'high',
      checklist: ['Client feedback recorded'],
      deliverables: ['Concept presentation'],
    }),
  ],
};

export const DESIGN_DEVELOPMENT_STAGE: TemplateStage = {
  key: 'design-development',
  name: 'Design development',
  description: 'Detail the design, select materials and estimate costs.',
  milestones: [{ key: 'design-freeze', name: 'Design frozen', requiresClientApproval: true }],
  tasks: [
    presetTask('visualisation', 'Produce 3D visualisations', 'designer', 6, {
      dependsOn: ['concept-presentation'],
      reviewBy: 'reviewer',
      deliverables: ['3D renders'],
    }),
    presetTask('working-drawings', 'Prepare working drawings', 'designer', 6, {
      dependsOn: ['concept-presentation'],
      reviewBy: 'reviewer',
      priority: 'high',
      checklist: ['Furniture layout', 'Electrical layout', 'False ceiling plan', 'Joinery details'],
      deliverables: ['Working drawing set'],
    }),
    presetTask('material-selection', 'Finalise materials and finishes', 'designer', 3, {
      dependsOn: ['concept-presentation'],
      checklist: ['Samples approved by client', 'Finish schedule updated'],
    }),
    presetTask('cost-estimate', 'Prepare the bill of quantities', 'manager', 3, {
      milestone: 'design-freeze',
      dependsOn: ['working-drawings', 'material-selection'],
      reviewBy: 'reviewer',
      deliverables: ['Bill of quantities'],
    }),
  ],
};

export const DESIGN_HANDOVER_STAGE: TemplateStage = {
  key: 'design-handover',
  name: 'Design handover',
  milestones: [
    { key: 'drawings-issued', name: 'Construction drawings issued', requiresClientApproval: false },
  ],
  tasks: [
    presetTask('construction-drawings', 'Issue good-for-construction drawings', 'designer', 2, {
      milestone: 'drawings-issued',
      dependsOn: ['cost-estimate', 'visualisation'],
      reviewBy: 'manager',
      deliverables: ['Good-for-construction drawing set'],
    }),
  ],
};
