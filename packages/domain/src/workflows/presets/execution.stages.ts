import type { TemplateStage } from '../workflow-template-definition';
import { presetTask } from './preset-helpers';

/** Procurement, site execution and handover for projects the studio builds. */
export const PROCUREMENT_STAGE: TemplateStage = {
  key: 'procurement',
  name: 'Procurement',
  requiresOptions: ['includes_execution'],
  milestones: [{ key: 'orders-placed', name: 'Orders placed', requiresClientApproval: false }],
  tasks: [
    presetTask('vendor-quotes', 'Collect and compare vendor quotes', 'manager', 4, {
      dependsOn: ['cost-estimate'],
      checklist: ['Three quotes per package', 'Lead times recorded'],
    }),
    presetTask('purchase-orders', 'Place purchase orders', 'manager', 2, {
      milestone: 'orders-placed',
      dependsOn: ['vendor-quotes'],
      priority: 'high',
      reviewBy: 'reviewer',
      deliverables: ['Purchase order register'],
    }),
  ],
};

export const SITE_EXECUTION_STAGE: TemplateStage = {
  key: 'execution',
  name: 'Site execution',
  requiresOptions: ['includes_execution'],
  milestones: [
    { key: 'civil-complete', name: 'Civil and services complete', requiresClientApproval: false },
    { key: 'installation-complete', name: 'Installation complete', requiresClientApproval: false },
  ],
  tasks: [
    presetTask('site-mobilisation', 'Mobilise the site team', 'site_supervisor', 1, {
      dependsOn: ['construction-drawings'],
      checklist: ['Society permissions in place', 'Material storage arranged'],
    }),
    presetTask(
      'civil-and-services',
      'Complete civil, electrical and plumbing work',
      'site_supervisor',
      12,
      {
        milestone: 'civil-complete',
        dependsOn: ['site-mobilisation'],
        priority: 'high',
        hoursPerDay: 3,
        checklist: [
          'Concealed wiring inspected',
          'Pressure test passed',
          'Photos before closing walls',
        ],
      },
    ),
    presetTask('carpentry-installation', 'Install carpentry and fixtures', 'site_supervisor', 10, {
      milestone: 'installation-complete',
      dependsOn: ['civil-and-services'],
      hoursPerDay: 3,
      checklist: ['Shutters aligned', 'Hardware fixed', 'Edge banding checked'],
    }),
    presetTask('quality-inspection', 'Run the quality inspection', 'reviewer', 1, {
      milestone: 'installation-complete',
      dependsOn: ['carpentry-installation'],
      priority: 'high',
      checklist: ['Inspection checklist complete', 'Defects photographed'],
      deliverables: ['Inspection report'],
    }),
  ],
};

export const PROJECT_HANDOVER_STAGE: TemplateStage = {
  key: 'handover',
  name: 'Snagging and handover',
  requiresOptions: ['includes_execution'],
  milestones: [
    { key: 'project-handover', name: 'Project handed over', requiresClientApproval: true },
  ],
  tasks: [
    presetTask('snag-resolution', 'Resolve the snag list', 'site_supervisor', 4, {
      dependsOn: ['quality-inspection'],
      checklist: ['Every snag closed with a photo'],
    }),
    presetTask('client-walkthrough', 'Walk the client through the finished space', 'manager', 1, {
      milestone: 'project-handover',
      dependsOn: ['snag-resolution'],
      priority: 'high',
      checklist: ['Warranty documents handed over', 'Client sign-off recorded'],
      deliverables: ['Handover certificate'],
    }),
  ],
};
