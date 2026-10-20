import type { TemplateStage } from '../workflow-template-definition';
import { presetTask } from './preset-helpers';

/** RIBA-style architecture stages, simplified for a small studio. */
export const ARCHITECTURE_STAGES: readonly TemplateStage[] = [
  {
    key: 'feasibility',
    name: 'Feasibility',
    milestones: [
      { key: 'feasibility-signoff', name: 'Feasibility signed off', requiresClientApproval: true },
    ],
    tasks: [
      presetTask('site-analysis', 'Analyse the site and bylaws', 'architect', 3, {
        priority: 'high',
        checklist: [
          'Plot boundaries confirmed',
          'FSI and setbacks calculated',
          'Soil report requested',
        ],
        deliverables: ['Site analysis report'],
      }),
      presetTask('area-programme', 'Agree the area programme', 'architect', 2, {
        milestone: 'feasibility-signoff',
        dependsOn: ['site-analysis'],
        reviewBy: 'manager',
        deliverables: ['Area statement'],
      }),
    ],
  },
  {
    key: 'schematic-design',
    name: 'Schematic design',
    milestones: [
      {
        key: 'schematic-approval',
        name: 'Schematic design approved',
        requiresClientApproval: true,
      },
    ],
    tasks: [
      presetTask('massing-options', 'Develop massing options', 'architect', 5, {
        dependsOn: ['area-programme'],
        reviewBy: 'reviewer',
        deliverables: ['Massing study'],
      }),
      presetTask('schematic-drawings', 'Draw schematic plans and elevations', 'architect', 6, {
        milestone: 'schematic-approval',
        dependsOn: ['massing-options'],
        reviewBy: 'reviewer',
        priority: 'high',
        deliverables: ['Schematic drawing set'],
      }),
    ],
  },
  {
    key: 'approvals',
    name: 'Statutory approvals',
    milestones: [
      { key: 'permit-received', name: 'Building permit received', requiresClientApproval: false },
    ],
    tasks: [
      presetTask('approval-drawings', 'Prepare municipal approval drawings', 'architect', 5, {
        dependsOn: ['schematic-drawings'],
        reviewBy: 'manager',
        priority: 'high',
        checklist: ['Structural stability certificate attached', 'Fire norms checked'],
        deliverables: ['Approval drawing set'],
      }),
      presetTask('approval-follow-up', 'Follow up the approval with the authority', 'manager', 10, {
        milestone: 'permit-received',
        dependsOn: ['approval-drawings'],
        hoursPerDay: 1,
        checklist: ['Submission receipt uploaded', 'Queries answered'],
      }),
    ],
  },
  {
    key: 'construction-documents',
    name: 'Construction documents',
    milestones: [
      { key: 'tender-issued', name: 'Tender package issued', requiresClientApproval: false },
    ],
    tasks: [
      presetTask('detail-drawings', 'Prepare detailed construction drawings', 'architect', 10, {
        dependsOn: ['schematic-drawings'],
        reviewBy: 'reviewer',
        deliverables: ['Construction drawing set'],
      }),
      presetTask(
        'consultant-coordination',
        'Coordinate structure and services consultants',
        'manager',
        5,
        {
          dependsOn: ['detail-drawings'],
          checklist: ['Structural drawings reconciled', 'MEP clashes resolved'],
        },
      ),
      presetTask('tender-package', 'Assemble the tender package', 'manager', 3, {
        milestone: 'tender-issued',
        dependsOn: ['consultant-coordination', 'approval-follow-up'],
        reviewBy: 'reviewer',
        deliverables: ['Tender documents'],
      }),
    ],
  },
];
