import { describe, expect, it } from 'vitest';
import {
  canSeeDocument,
  checkDocumentArchive,
  checkDocumentUpload,
  type DocumentViewer,
  documentKindOf,
  titleFromFileName,
} from './document-rules';

const designer: DocumentViewer = {
  userId: 'designer',
  canManageProject: false,
  canViewConfidential: false,
};
const manager: DocumentViewer = {
  userId: 'pm',
  canManageProject: true,
  canViewConfidential: false,
};
const auditor: DocumentViewer = {
  userId: 'auditor',
  canManageProject: false,
  canViewConfidential: true,
};

describe('document visibility', () => {
  it('shows project documents to everyone with project access', () => {
    const document = { visibility: 'project' as const, addedByUserId: 'pm' };
    expect(canSeeDocument(document, designer)).toBe(true);
    expect(canSeeDocument(document, manager)).toBe(true);
  });

  it('keeps confidential documents (and their names) from people who do not manage the project', () => {
    const contract = { visibility: 'confidential' as const, addedByUserId: 'pm' };
    expect(canSeeDocument(contract, designer)).toBe(false);
    expect(canSeeDocument(contract, manager)).toBe(true);
    expect(canSeeDocument(contract, auditor)).toBe(true);
  });

  it('always shows a confidential document to the person who added it', () => {
    const own = { visibility: 'confidential' as const, addedByUserId: 'designer' };
    expect(canSeeDocument(own, designer)).toBe(true);
  });
});

describe('adding and archiving documents', () => {
  it('lets anyone on the project add project documents', () => {
    expect(checkDocumentUpload('project', designer)).toEqual({ allowed: true });
  });

  it('lets only managers file confidential documents', () => {
    expect(checkDocumentUpload('confidential', designer).allowed).toBe(false);
    expect(checkDocumentUpload('confidential', manager)).toEqual({ allowed: true });
    expect(checkDocumentUpload('confidential', auditor)).toEqual({ allowed: true });
  });

  it('lets the person who added it or a manager archive it, once', () => {
    const mine = { visibility: 'project' as const, addedByUserId: 'designer', archived: false };
    expect(checkDocumentArchive(mine, designer)).toEqual({ allowed: true });
    expect(checkDocumentArchive(mine, manager)).toEqual({ allowed: true });
    expect(checkDocumentArchive({ ...mine, addedByUserId: 'someone' }, designer).allowed).toBe(
      false,
    );
    expect(checkDocumentArchive({ ...mine, archived: true }, manager).allowed).toBe(false);
  });
});

describe('document presentation helpers', () => {
  it('knows the kind of each allowed file type', () => {
    expect(documentKindOf('image/heic')).toBe('image');
    expect(documentKindOf('image/vnd.dwg')).toBe('drawing');
    expect(documentKindOf('application/pdf')).toBe('pdf');
    expect(
      documentKindOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('spreadsheet');
  });

  it('derives a readable title from the file name', () => {
    expect(titleFromFileName('Ground_floor_plan_rev-C.dwg')).toBe('Ground floor plan rev-C');
    expect(titleFromFileName('.pdf')).toBe('Untitled document');
  });
});
