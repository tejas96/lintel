/**
 * Detects a file's real type from its first bytes. The browser-declared
 * content type is never trusted. Only types studios actually exchange are allowed.
 */
export interface DetectedFileType {
  readonly contentType: string;
  readonly extension: string;
  readonly isImage: boolean;
}

const startsWith = (buffer: Buffer, bytes: readonly number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const ascii = (buffer: Buffer, start: number, end: number) =>
  buffer.subarray(start, end).toString('latin1');

const OFFICE_TYPES: Readonly<Record<string, DetectedFileType>> = {
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    isImage: false,
  },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    isImage: false,
  },
  pptx: {
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
    isImage: false,
  },
};

export function detectFileType(buffer: Buffer, declaredName: string): DetectedFileType | null {
  if (buffer.length < 12) return null;
  if (startsWith(buffer, [0xff, 0xd8, 0xff]))
    return { contentType: 'image/jpeg', extension: 'jpg', isImage: true };
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: 'image/png', extension: 'png', isImage: true };
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp', isImage: true };
  }
  if (ascii(buffer, 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1)$/.test(ascii(buffer, 8, 12))) {
    return { contentType: 'image/heic', extension: 'heic', isImage: true };
  }
  if (ascii(buffer, 0, 5) === '%PDF-')
    return { contentType: 'application/pdf', extension: 'pdf', isImage: false };
  if (/^AC10\d\d$/.test(ascii(buffer, 0, 6))) {
    return { contentType: 'image/vnd.dwg', extension: 'dwg', isImage: false };
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    const extension = declaredName.toLowerCase().split('.').pop() ?? '';
    return (
      OFFICE_TYPES[extension] ?? {
        contentType: 'application/zip',
        extension: 'zip',
        isImage: false,
      }
    );
  }
  return null;
}
