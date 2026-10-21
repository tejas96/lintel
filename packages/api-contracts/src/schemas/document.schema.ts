import { DOCUMENT_FOLDERS, DOCUMENT_VISIBILITIES } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { fileSummarySchema } from './task.schema';

export const documentFolderSchema = z.enum(DOCUMENT_FOLDERS);
export const documentVisibilitySchema = z.enum(DOCUMENT_VISIBILITIES);
export const documentKindSchema = z.enum([
  'image',
  'pdf',
  'drawing',
  'spreadsheet',
  'presentation',
  'text',
]);
/** Filters by what a file is, independent of its folder. */
export const documentKindFilterSchema = z.enum(['image', 'pdf', 'drawing', 'office']);

export const projectDocumentObject = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string(),
  folder: documentFolderSchema,
  visibility: documentVisibilitySchema,
  kind: documentKindSchema,
  file: fileSummarySchema,
  addedBy: userSummarySchema,
  createdAt: instantSchema,
  archivedAt: instantSchema.nullable(),
  viewerCanArchive: z.boolean(),
  version: z.number().int(),
});
export type ProjectDocument = z.infer<typeof projectDocumentObject>;
export const projectDocumentSchema: ResponseSchema<ProjectDocument> = projectDocumentObject;

const folderCountsObject = z.object({
  all: z.number().int(),
  drawings: z.number().int(),
  contracts: z.number().int(),
  mood_boards: z.number().int(),
  site_photos: z.number().int(),
  other: z.number().int(),
});

export const documentLibraryObject = z.object({
  items: z.array(projectDocumentSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  /** Counts for the same search, per folder, so filters can show them. */
  folderCounts: folderCountsObject,
  viewer: z.object({
    canUpload: z.boolean(),
    canUploadConfidential: z.boolean(),
  }),
});
export type DocumentLibrary = z.infer<typeof documentLibraryObject>;
export const documentLibrarySchema: ResponseSchema<DocumentLibrary> = documentLibraryObject;
