import { describe, expect, it } from 'vitest';
import { detectFileType } from './file-type.detector';
import { generateObjectKey, safeDownloadName } from './object-key';

const pad = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('file type detection', () => {
  it('recognises images and PDFs from their bytes', () => {
    expect(detectFileType(pad([0xff, 0xd8, 0xff, 0xe0]), 'photo.png')?.contentType).toBe(
      'image/jpeg',
    );
    expect(detectFileType(Buffer.from('%PDF-1.7 rest of file'), 'x.pdf')?.extension).toBe('pdf');
  });

  it('uses the name only to tell Office files apart', () => {
    expect(detectFileType(pad([0x50, 0x4b, 0x03, 0x04]), 'BOQ.xlsx')?.extension).toBe('xlsx');
    expect(detectFileType(pad([0x50, 0x4b, 0x03, 0x04]), 'archive.bin')?.extension).toBe('zip');
  });

  it('rejects unknown or disguised content', () => {
    expect(
      detectFileType(Buffer.from('#!/bin/sh\nrm -rf / # pretend.jpg'), 'pretend.jpg'),
    ).toBeNull();
  });
});

describe('object keys', () => {
  it('never contains the original file name', () => {
    const key = generateObjectKey('deliverables', 'pdf', new Date('2026-10-21T00:00:00Z'));
    expect(key).toMatch(/^deliverables\/2026\/10\/[0-9a-f-]{36}\.pdf$/);
  });

  it('sanitises download names', () => {
    expect(safeDownloadName('../../"evil"\n.pdf')).toBe('....evil.pdf');
  });
});
