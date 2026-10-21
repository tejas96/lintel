import {
  CompleteMilestoneCommand,
  CreateProjectCommand,
  ProposeScopeChangeCommand,
  shiftByWorkingDays,
} from '@lintel/application';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Database } from '../../client';
import { projects, tasks } from '../../schema';
import { createDemoContext, type DemoContext } from './demo-context';
import { applyDemoProgress } from './demo-progress.writer';
import { DEMO_PROJECTS, type DemoProject } from './demo-projects';
import { seedDemoRewards } from './seed-demo-rewards';

async function createDemoProject(context: DemoContext, demo: DemoProject): Promise<string> {
  const templateVersionId = await context.publishedTemplateVersion(demo.projectType);
  if (!templateVersionId) throw new Error(`No published template for ${demo.projectType}.`);
  const calendar = await context.deps.uow.stores.settings.defaultCalendar();
  const start = shiftByWorkingDays(calendar, context.today, -demo.startedWorkingDaysAgo);
  const manager = await context.actingAs(demo.manager);
  const { id, reference } = await new CreateProjectCommand(context.deps).execute(manager, {
    name: demo.name,
    clientName: demo.clientName,
    clientPhone: null,
    clientEmail: null,
    siteAddress: demo.siteAddress,
    projectType: demo.projectType,
    description: demo.description,
    criticality: demo.criticality,
    managerUserId: manager.actor.userId,
    plannedStartDate: start,
    templateVersionId,
    templateOptions: demo.options,
    members: demo.members.map((member) => ({
      userId: context.personId(member.person),
      projectRole: member.role,
    })),
    budgetMinor: demo.budgetMinor,
  });
  const dueMilestones = await applyDemoProgress(
    context.db,
    { id, managerUserId: manager.actor.userId },
    demo.progress,
    context.today,
  );
  const complete = new CompleteMilestoneCommand(context.deps);
  for (const milestone of dueMilestones) {
    await complete.execute(manager, milestone.id, milestone.version, 'Signed off with the client.');
  }
  await proposeScopeChange(context, demo, id);
  return reference;
}

async function proposeScopeChange(context: DemoContext, demo: DemoProject, projectId: string) {
  const change = demo.progress.scopeChange;
  const designer = demo.members.find((member) => member.role === 'designer');
  if (!change || !designer) return;
  const [next] = await context.db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, 'ready'),
        gt(tasks.plannedStartDate, context.today),
      ),
    )
    .orderBy(asc(tasks.plannedStartDate), asc(tasks.number))
    .limit(1);
  if (!next) return;
  await new ProposeScopeChangeCommand(context.deps).propose(
    await context.actingAs(designer.person),
    projectId,
    {
      title: change.title,
      description: change.description,
      taskShifts: [{ taskId: next.id, shiftWorkingDays: change.shift }],
      newTasks: [],
      cancelTaskIds: [],
    },
  );
}

/**
 * Creates the demo projects through the real CreateProject use case, then
 * brings each one to "today". Projects that already exist (by name) are
 * left alone, so running the seed again changes nothing.
 */
export async function seedDemoProjects(
  db: Database,
): Promise<{ created: string[]; skipped: string[] }> {
  const context = await createDemoContext(db);
  const created: string[] = [];
  const skipped: string[] = [];
  for (const demo of DEMO_PROJECTS) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, demo.name))
      .limit(1);
    if (existing) {
      skipped.push(demo.name);
      continue;
    }
    created.push(`${await createDemoProject(context, demo)} ${demo.name}`);
  }
  if (await seedDemoRewards(db, context))
    created.push('Reliable delivery bonus (reward policy + current month evaluation)');
  return { created, skipped };
}
