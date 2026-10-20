import type { DeliverableRecord, DeliverableStore } from '../deliverables/deliverable.store';
import type { InMemoryOperationsWorld } from './in-memory-operations.world';

const unused = (name: string) => () => {
  throw new Error(`${name} is not used by these tests.`);
};

/** DeliverableStore over the in-memory world, with optimistic versions like the SQL one. */
export function buildDeliverableStore(world: InMemoryOperationsWorld): DeliverableStore {
  const findDeliverable = async (id: string) =>
    world.deliverables.find((item) => item.id === id) ?? null;
  return {
    createFile: unused('createFile'),
    async findFile(fileId) {
      return world.files.find((file) => file.id === fileId) ?? null;
    },
    async claimFileForProject(fileId, projectId) {
      const index = world.files.findIndex((file) => file.id === fileId);
      const file = world.files[index];
      if (file && file.projectId === null) {
        world.files[index] = {
          ...file,
          projectId,
          visibility: file.visibility === 'private' ? 'project' : file.visibility,
        };
      }
    },
    async createDeliverable(input) {
      const record: DeliverableRecord = {
        id: world.nextId('deliverable'),
        projectId: input.projectId,
        taskId: input.taskId,
        name: input.name,
        isRequired: input.isRequired,
        status: 'not_submitted',
        reviewerUserId: input.reviewerUserId,
        currentVersionNumber: 0,
        version: 1,
      };
      world.deliverables.push(record);
      return record;
    },
    findDeliverable,
    findDeliverableForUpdate: findDeliverable,
    async updateDeliverable(id, expectedVersion, changes) {
      const index = world.deliverables.findIndex((item) => item.id === id);
      const current = world.deliverables[index];
      if (!current || current.version !== expectedVersion) return null;
      const next: DeliverableRecord = {
        ...current,
        status: changes.status,
        currentVersionNumber: changes.currentVersionNumber ?? current.currentVersionNumber,
        version: current.version + 1,
      };
      world.deliverables[index] = next;
      return next;
    },
    async addVersion(input) {
      const record = {
        id: world.nextId('version'),
        deliverableId: input.deliverableId,
        versionNumber: input.versionNumber,
        fileId: input.fileId,
        submittedByUserId: input.submittedByUserId,
        decision: 'pending' as const,
      };
      world.versions.push(record);
      return record;
    },
    async findVersion(versionId) {
      return world.versions.find((item) => item.id === versionId) ?? null;
    },
    async latestVersion(deliverableId) {
      const versions = world.versions.filter((item) => item.deliverableId === deliverableId);
      return versions.sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
    },
    async decideVersion(versionId, decision) {
      const index = world.versions.findIndex((item) => item.id === versionId);
      const current = world.versions[index];
      if (current) world.versions[index] = { ...current, decision: decision.decision };
    },
    createSiteUpdate: unused('createSiteUpdate'),
  };
}
