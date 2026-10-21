import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema } from '../common/pagination';
import { idSchema, versionSchema } from '../common/primitives';
import {
  documentFolderSchema,
  documentKindFilterSchema,
  documentLibrarySchema,
  projectDocumentSchema,
} from '../schemas/document.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** The project document library: drawings, contracts, mood boards and site photos not tied to a task. */
export const documentsContract = c.router({
  listProjectDocuments: {
    method: 'GET',
    path: '/projects/:id/documents',
    pathParams: idParams,
    query: pageQuerySchema.extend({
      folder: documentFolderSchema.optional(),
      kind: documentKindFilterSchema.optional(),
      search: z.string().trim().max(100).optional(),
    }),
    responses: { 200: documentLibrarySchema },
    summary:
      'Documents the viewer may see, newest first. Confidential documents (and their titles) are left out for people who may not read them.',
  },
  uploadProjectDocument: {
    method: 'POST',
    path: '/projects/:id/documents',
    pathParams: idParams,
    contentType: 'multipart/form-data',
    body: c.type<{
      file: Blob;
      title?: string;
      folder?: string;
      visibility?: 'project' | 'confidential';
    }>(),
    responses: { 201: projectDocumentSchema },
    summary:
      'Add a document (field "file"; optional title, folder, visibility). Type is detected from content; size is limited. Only project managers may file confidential documents.',
  },
  getDocument: {
    method: 'GET',
    path: '/documents/:id',
    pathParams: idParams,
    responses: { 200: projectDocumentSchema },
    summary: 'One document. Open the file with GET /v1/files/:fileId/content.',
  },
  archiveDocument: {
    method: 'POST',
    path: '/documents/:id/archive',
    pathParams: idParams,
    body: z.object({
      reason: z.string().trim().max(500).nullable(),
      version: versionSchema,
    }),
    responses: { 200: projectDocumentSchema },
    summary:
      'Archive (soft delete): the document leaves the library and its file is no longer served. Audited.',
  },
});
