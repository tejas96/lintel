import type { ProjectCriticality, ProjectRole, ProjectType } from '@lintel/domain';

/** Keys of the people created by the foundation seed (see seed-people.ts). */
export type DemoPersonKey =
  | 'owner'
  | 'admin'
  | 'pm1'
  | 'pm2'
  | 'lead'
  | 'designer1'
  | 'designer2'
  | 'designer3'
  | 'architect'
  | 'site';

export interface DemoBlocker {
  readonly category: 'client' | 'supplier' | 'internal_dependency' | 'information';
  readonly reason: string;
  readonly raisedDaysAgo: number;
}

/** How far along the project is "today", so health and queues look lived-in. */
export interface DemoProgress {
  /** Past-due tasks deliberately left unfinished. */
  readonly overdue: number;
  /** Current tasks sitting with a reviewer. */
  readonly inReview: number;
  readonly blockers: readonly DemoBlocker[];
  readonly scopeChange?: {
    readonly title: string;
    readonly description: string;
    readonly shift: number;
  };
}

export interface DemoProject {
  readonly name: string;
  readonly clientName: string;
  readonly siteAddress: string;
  readonly projectType: ProjectType;
  readonly criticality: ProjectCriticality;
  readonly description: string;
  readonly manager: DemoPersonKey;
  readonly members: readonly { readonly person: DemoPersonKey; readonly role: ProjectRole }[];
  readonly options: readonly string[];
  /** Working days between the planned start and today; negative starts in the future. */
  readonly startedWorkingDaysAgo: number;
  readonly budgetMinor: number;
  readonly progress: DemoProgress;
}

const lead = { person: 'lead', role: 'reviewer' } as const;
const site = { person: 'site', role: 'site_supervisor' } as const;

/** Six obviously fictional projects covering every project type and health state. */
export const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    name: 'Saska Residence',
    clientName: 'Mira & Ishaan Saska',
    siteAddress: '14 Lantern Lane, Fictional Heights, Pune',
    projectType: 'residential_interior',
    criticality: 'normal',
    description: 'Three-bedroom apartment: warm minimal interiors, design only.',
    manager: 'pm1',
    members: [{ person: 'designer1', role: 'designer' }, site, lead],
    options: [],
    startedWorkingDaysAgo: 14,
    budgetMinor: 1_850_000_00,
    progress: { overdue: 0, inReview: 1, blockers: [] },
  },
  {
    name: 'Kiln & Co. Café',
    clientName: 'Kiln & Co. Hospitality (fictional)',
    siteAddress: 'Unit 3, Clayworks Arcade, Example Road, Bengaluru',
    projectType: 'commercial_interior',
    criticality: 'high',
    description: 'Forty-cover café fit-out with a show kitchen and studio-built counter.',
    manager: 'pm2',
    members: [{ person: 'designer2', role: 'designer' }, site, lead],
    options: ['includes_execution'],
    startedWorkingDaysAgo: 30,
    budgetMinor: 4_200_000_00,
    progress: {
      overdue: 1,
      inReview: 0,
      blockers: [
        {
          category: 'client',
          reason: 'Waiting for the client to confirm the counter stone sample.',
          raisedDaysAgo: 3,
        },
      ],
    },
  },
  {
    name: 'Banyan Court Villa',
    clientName: 'The Banyan Trust (fictional)',
    siteAddress: 'Plot 22, Imaginary Greens, Alibaug',
    projectType: 'architecture',
    criticality: 'critical',
    description: 'Courtyard villa on a sloping plot: feasibility through construction documents.',
    manager: 'pm2',
    members: [{ person: 'architect', role: 'architect' }, lead],
    options: [],
    startedWorkingDaysAgo: 22,
    budgetMinor: 9_500_000_00,
    progress: { overdue: 3, inReview: 1, blockers: [] },
  },
  {
    name: 'Marigold Loft',
    clientName: 'Anaya Marigold',
    siteAddress: 'Loft 7B, Placeholder Mills, Mumbai',
    projectType: 'interior_and_execution',
    criticality: 'normal',
    description: 'Double-height loft with a mezzanine library; design and execution.',
    manager: 'pm1',
    members: [{ person: 'designer3', role: 'designer' }, site, lead],
    options: ['includes_execution'],
    startedWorkingDaysAgo: 34,
    budgetMinor: 3_100_000_00,
    progress: {
      overdue: 0,
      inReview: 0,
      blockers: [
        {
          category: 'supplier',
          reason: 'Laminate supplier delayed the dispatch of the wardrobe shutters.',
          raisedDaysAgo: 4,
        },
      ],
      scopeChange: {
        title: 'Add a reading nook under the stairs',
        description: 'Client asked for built-in seating and shelves under the mezzanine stair.',
        shift: 2,
      },
    },
  },
  {
    name: 'Tidewater Offices',
    clientName: 'Tidewater Analytics (fictional)',
    siteAddress: 'Level 5, Sample Tower, Hyderabad',
    projectType: 'turnkey',
    criticality: 'high',
    description: 'Turnkey 60-seat office: workplace strategy to keys in hand.',
    manager: 'pm1',
    members: [{ person: 'designer1', role: 'designer' }, site, lead],
    options: ['includes_execution'],
    startedWorkingDaysAgo: 7,
    budgetMinor: 7_800_000_00,
    progress: { overdue: 0, inReview: 1, blockers: [] },
  },
  {
    name: 'Juniper Studio Flat',
    clientName: 'Rhea Juniper',
    siteAddress: 'Flat 2, Demo Residency, Goa',
    projectType: 'other',
    criticality: 'low',
    description: 'Compact studio refresh: brief and concept only.',
    manager: 'pm2',
    members: [{ person: 'designer3', role: 'designer' }, site],
    options: [],
    startedWorkingDaysAgo: -3,
    budgetMinor: 450_000_00,
    progress: { overdue: 0, inReview: 0, blockers: [] },
  },
];
