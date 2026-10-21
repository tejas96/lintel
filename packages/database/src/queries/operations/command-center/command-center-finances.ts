import {
  assessProfitability,
  compareByMarginAttention,
  type ProfitabilityAssessment,
} from '@lintel/domain';
import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import { projects } from '../../../schema';
import { recordedCostByProject } from '../../finances/project-profitability.query';
import type { ProjectRefView } from '../../shared/view-types';
import type { CommandCenterScope } from './command-center-scope';

export interface FinanceViewer {
  readonly userId: string;
  /** `projects.manage_any`: every project's budget; otherwise only projects they manage or own. */
  readonly seesAllBudgets: boolean;
}

export interface PortfolioProfitabilityView extends ProfitabilityAssessment {
  readonly currency: string;
  readonly projectsWithBudget: number;
  readonly projectsOverBudget: number;
  readonly projectsThinMargin: number;
  readonly projects: ({ project: ProjectRefView } & ProfitabilityAssessment)[];
}

const PROJECT_LIMIT = 12;

/**
 * Budget against recorded cost over the scoped projects whose budgets the
 * viewer may see. Portfolio totals add up only projects that have a budget,
 * so a project without one never distorts the margin. Null when the viewer
 * may see no budget in this view.
 */
export async function portfolioProfitability(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  viewer: FinanceViewer,
  currency: string,
): Promise<PortfolioProfitabilityView | null> {
  if (scope.projectIds.length === 0) return null;
  const rows = await db
    .select({
      id: projects.id,
      reference: projects.reference,
      name: projects.name,
      colorIndex: projects.colorIndex,
      budgetMinor: projects.budgetMinor,
      managerUserId: projects.managerUserId,
      ownerUserId: projects.ownerUserId,
    })
    .from(projects)
    .where(inArray(projects.id, scope.projectIds));
  const visible = rows.filter(
    (row) =>
      viewer.seesAllBudgets ||
      row.managerUserId === viewer.userId ||
      row.ownerUserId === viewer.userId,
  );
  if (visible.length === 0) return null;
  const costs = await recordedCostByProject(
    db,
    visible.map((row) => row.id),
  );
  const assessed = visible.map((row) => ({
    project: { id: row.id, reference: row.reference, name: row.name, colorIndex: row.colorIndex },
    ...assessProfitability(row.budgetMinor, costs.get(row.id) ?? 0),
  }));
  const budgeted = assessed.filter((row) => row.indicator !== 'no_budget');
  const total = assessProfitability(
    budgeted.length > 0 ? budgeted.reduce((sum, row) => sum + (row.budgetMinor ?? 0), 0) : null,
    budgeted.reduce((sum, row) => sum + row.recordedCostMinor, 0),
  );
  return {
    currency,
    ...total,
    projectsWithBudget: budgeted.length,
    projectsOverBudget: assessed.filter((row) => row.indicator === 'over_budget').length,
    projectsThinMargin: assessed.filter((row) => row.indicator === 'thin').length,
    projects: assessed.sort(compareByMarginAttention).slice(0, PROJECT_LIMIT),
  };
}
