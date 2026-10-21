import type { client } from './journey-helpers';
import { nextMonday } from './journey-helpers';

type Client = ReturnType<typeof client>;

interface DefinitionTask {
  key: string;
  title: string;
  priority: string;
  durationDays: number;
  dependsOn: string[];
  [field: string]: unknown;
}

interface DefinitionStage {
  key: string;
  name: string;
  tasks: DefinitionTask[];
  milestones: { key: string; name: string; requiresClientApproval: boolean }[];
  [field: string]: unknown;
}

export interface Definition {
  options: unknown[];
  stages: DefinitionStage[];
}

/** A private copy of the residential template (version 1 published), so other tests are unaffected. */
export async function publishTemplateCopy(owner: Client, name: string) {
  const templates = await owner.get('/v1/templates?projectType=residential_interior').expect(200);
  const source = templates.body.find(
    (item: { name: string; publishedVersion: unknown }) =>
      item.name === 'Residential interiors' && item.publishedVersion,
  );
  const created = await owner
    .post('/v1/templates', {
      name,
      description: null,
      projectType: 'residential_interior',
      copyFromVersionId: source.publishedVersion.id,
    })
    .expect(201);
  const draft = created.body.versions.find(
    (version: { status: string }) => version.status === 'draft',
  );
  const published = await owner
    .post(`/v1/templates/${created.body.id}/publish`, { version: draft.version })
    .expect(200);
  return {
    templateId: created.body.id as string,
    versionId: published.body.publishedVersion.id as string,
    definition: draft.definition as Definition,
  };
}

/** Saves and publishes the next version of a template. */
export async function publishNextVersion(
  owner: Client,
  templateId: string,
  definition: Definition,
) {
  const saved = await owner
    .put(`/v1/templates/${templateId}/draft`, {
      definition,
      changeNotes: 'Second version for the update test',
      version: null,
    })
    .expect(200);
  const draft = saved.body.versions.find(
    (version: { status: string }) => version.status === 'draft',
  );
  const published = await owner
    .post(`/v1/templates/${templateId}/publish`, { version: draft.version })
    .expect(200);
  return published.body.publishedVersion.id as string;
}

/** A project on the given template version, staffed like the journey projects. */
export async function createProjectOn(
  owner: Client,
  versionId: string,
  people: { pm: string; designer: string; lead: string; site: string },
): Promise<string> {
  const created = await owner
    .post('/v1/projects', {
      name: `Update Residence ${Date.now()}`,
      clientName: 'Update Family',
      clientPhone: null,
      clientEmail: null,
      siteAddress: null,
      projectType: 'residential_interior',
      description: null,
      criticality: 'normal',
      managerUserId: people.pm,
      plannedStartDate: nextMonday(),
      templateVersionId: versionId,
      templateOptions: [],
      members: [
        { userId: people.designer, projectRole: 'designer' },
        { userId: people.lead, projectRole: 'reviewer' },
        { userId: people.site, projectRole: 'site_supervisor' },
      ],
      budgetMinor: null,
    })
    .expect(201);
  return created.body.id as string;
}
