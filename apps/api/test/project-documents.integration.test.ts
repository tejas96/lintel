import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, TINY_PNG, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/** A minimal PDF: enough for content sniffing to recognise it. */
const TINY_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

let testApp: TestApp;
let projectId: string;
type Client = ReturnType<typeof client>;
const people: Record<'owner' | 'pm' | 'designer' | 'outsider', Client> = {} as never;

beforeAll(async () => {
  testApp = await createTestApp();
  people.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  people.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  people.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  people.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  projectId = await createJourneyProject(people.owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await testApp.close();
});

describe('project documents library', () => {
  it('stores documents with content detection and files them by folder', async () => {
    const photo = await people.designer
      .upload(`/v1/projects/${projectId}/documents`, TINY_PNG, 'north_wall.png', {
        folder: 'site_photos',
      })
      .expect(201);
    expect(photo.body).toMatchObject({
      title: 'north wall',
      folder: 'site_photos',
      visibility: 'project',
      kind: 'image',
      viewerCanArchive: true,
    });
    const refused = await people.designer
      .upload(`/v1/projects/${projectId}/documents`, Buffer.from('MZ not a document'), 'tool.exe')
      .expect(400);
    expect(refused.body.code).toBe('VALIDATION_FAILED');
    const list = await people.pm
      .get(`/v1/projects/${projectId}/documents?folder=site_photos`)
      .expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toContain(photo.body.id);
    expect(list.body.folderCounts.site_photos).toBeGreaterThanOrEqual(1);
    await people.pm.get(`/v1/files/${photo.body.file.id}/content`).expect(200);
  });

  it('answers 404 to people outside the project for every document route', async () => {
    const photo = await people.pm
      .upload(`/v1/projects/${projectId}/documents`, TINY_PNG, 'plan.png', { folder: 'drawings' })
      .expect(201);
    await people.outsider.get(`/v1/projects/${projectId}/documents`).expect(404);
    await people.outsider.get(`/v1/documents/${photo.body.id}`).expect(404);
    await people.outsider
      .post(`/v1/documents/${photo.body.id}/archive`, { reason: null, version: 1 })
      .expect(404);
    await people.outsider.get(`/v1/files/${photo.body.file.id}/content`).expect(404);
    await people.outsider
      .upload(`/v1/projects/${projectId}/documents`, TINY_PNG, 'sneaky.png')
      .expect(404);
  });

  it('keeps confidential documents, and their names, from designers', async () => {
    const contract = await people.pm
      .upload(`/v1/projects/${projectId}/documents`, TINY_PDF, 'Fee agreement.pdf', {
        folder: 'contracts',
        visibility: 'confidential',
        title: 'Signed fee agreement',
      })
      .expect(201);
    expect(contract.body.visibility).toBe('confidential');

    const designerList = await people.designer
      .get(`/v1/projects/${projectId}/documents`)
      .expect(200);
    const serialised = JSON.stringify(designerList.body);
    expect(serialised).not.toContain('Signed fee agreement');
    expect(serialised).not.toContain('Fee agreement.pdf');
    expect(designerList.body.folderCounts.contracts).toBe(0);
    expect(designerList.body.viewer.canUploadConfidential).toBe(false);
    await people.designer.get(`/v1/documents/${contract.body.id}`).expect(404);
    await people.designer.get(`/v1/files/${contract.body.file.id}/content`).expect(404);
    const activity = await people.designer.get(`/v1/projects/${projectId}/activity`).expect(200);
    expect(JSON.stringify(activity.body)).not.toContain('Signed fee agreement');

    const ownerList = await people.owner.get(`/v1/projects/${projectId}/documents`).expect(200);
    expect(JSON.stringify(ownerList.body)).toContain('Signed fee agreement');
  });

  it('lets only managers file confidential documents', async () => {
    const refused = await people.designer
      .upload(`/v1/projects/${projectId}/documents`, TINY_PDF, 'salary.pdf', {
        visibility: 'confidential',
      })
      .expect(403);
    expect(refused.body.message).toContain('project manager');
  });

  it('archives with an audit record; only the person who added it or a manager may', async () => {
    const board = await people.pm
      .upload(`/v1/projects/${projectId}/documents`, TINY_PNG, 'mood.png', {
        folder: 'mood_boards',
      })
      .expect(201);
    expect(board.body.viewerCanArchive).toBe(true);
    const asDesigner = await people.designer.get(`/v1/documents/${board.body.id}`).expect(200);
    expect(asDesigner.body.viewerCanArchive).toBe(false);
    await people.designer
      .post(`/v1/documents/${board.body.id}/archive`, { reason: null, version: board.body.version })
      .expect(403);
    const archived = await people.pm
      .post(`/v1/documents/${board.body.id}/archive`, {
        reason: 'Replaced by the revised board',
        version: board.body.version,
      })
      .expect(200);
    expect(archived.body.archivedAt).not.toBeNull();
    await people.pm
      .post(`/v1/documents/${board.body.id}/archive`, {
        reason: null,
        version: archived.body.version,
      })
      .expect(422);
    await people.pm.get(`/v1/files/${board.body.file.id}/content`).expect(404);
    const list = await people.pm.get(`/v1/projects/${projectId}/documents`).expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(board.body.id);
    const audit = await testApp.database.pool.query(
      "SELECT action FROM audit_log WHERE entity_type = 'project_document' AND entity_id = $1 ORDER BY created_at",
      [board.body.id],
    );
    expect(audit.rows.map((row: { action: string }) => row.action)).toEqual([
      'document.added',
      'document.archived',
    ]);
  });
});
