import type { ReportQuery } from '@lintel/api-contracts';
import {
  CapacityQuery,
  type OrganizationSettings,
  ProjectAccessService,
  planReport,
  type ReportPlan,
  type RequestContext,
} from '@lintel/application';
import {
  type DatabaseConnection,
  loadApprovalsReport,
  loadDelaysReport,
  loadDeliveryReport,
  loadEstimatesReport,
  loadLeaveReport,
  loadReworkReport,
  loadWorkloadReport,
  managesAnyProject,
} from '@lintel/database';
import { type Clock, NotFoundError } from '@lintel/shared';
import { Inject, Injectable } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, DATABASE_CONNECTION } from '../../infrastructure/tokens';

interface PlannedReport {
  readonly plan: ReportPlan;
  readonly settings: OrganizationSettings;
  readonly sources: { readonly timeZone: string; readonly now: Date };
}

/**
 * Builds reports for the viewer. Access: `planReport` (403 for people who
 * are neither leadership nor managing projects); a project filter must be a
 * project the viewer can see — and, in the managed scope, one they manage —
 * otherwise 404. Leave is limited to the people the viewer's leave and
 * capacity rights cover (everyone in the business view).
 */
@Injectable()
export class ReportRunner {
  constructor(
    private readonly access: ProjectAccessService,
    private readonly capacity: CapacityQuery,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async delivery(context: RequestContext, query: ReportQuery) {
    const { plan, sources } = await this.plan(context, query);
    return loadDeliveryReport(this.database.db, plan, sources);
  }

  async workload(context: RequestContext, query: ReportQuery) {
    const { plan, settings, sources } = await this.plan(context, query);
    return loadWorkloadReport(this.database.db, plan, {
      ...sources,
      workTrackingEnabled: settings.workTrackingEnabled,
    });
  }

  async leave(context: RequestContext, query: ReportQuery) {
    const { plan, sources } = await this.plan(context, query);
    return loadLeaveReport(this.database.db, plan, {
      ...sources,
      audience: await this.audience(context, plan),
    });
  }

  async approvals(context: RequestContext, query: ReportQuery) {
    const { plan, sources } = await this.plan(context, query);
    return loadApprovalsReport(this.database.db, plan, {
      ...sources,
      audience: await this.audience(context, plan),
    });
  }

  async estimates(context: RequestContext, query: ReportQuery) {
    const { plan, settings, sources } = await this.plan(context, query);
    return loadEstimatesReport(this.database.db, plan, {
      ...sources,
      workTrackingEnabled: settings.workTrackingEnabled,
    });
  }

  async rework(context: RequestContext, query: ReportQuery) {
    const { plan, sources } = await this.plan(context, query);
    return loadReworkReport(this.database.db, plan, sources);
  }

  async delays(context: RequestContext, query: ReportQuery) {
    const { plan, sources } = await this.plan(context, query);
    return loadDelaysReport(this.database.db, plan, sources);
  }

  /** The studio timezone, for formatting instants in exports. */
  async timeZone(): Promise<string> {
    return (await this.business.settings()).timeZone;
  }

  private async plan(context: RequestContext, query: ReportQuery): Promise<PlannedReport> {
    const [today, settings, manages] = await Promise.all([
      this.business.today(),
      this.business.settings(),
      managesAnyProject(this.database.db, context.actor.userId),
    ]);
    const plan = planReport(context.actor, query, today, manages);
    if (plan.projectId) {
      const access = await this.access.requireView(context.actor, plan.projectId);
      if (plan.scope === 'managed' && access.managerUserId !== context.actor.userId) {
        throw new NotFoundError('Project');
      }
    }
    return { plan, settings, sources: { timeZone: settings.timeZone, now: this.clock.now() } };
  }

  private async audience(context: RequestContext, plan: ReportPlan) {
    return plan.scope === 'business' ? null : this.capacity.audienceOf(context);
  }
}
