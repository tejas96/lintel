export interface DetectedFileKind {
  readonly contentType: string;
  readonly extension: string;
  readonly isImage: boolean;
}

/** Content sniffing and storage keys, implemented by the storage integration. */
export interface FileInspector {
  /** The real type from the file's bytes, or null for anything not allowed. */
  detect(buffer: Buffer, declaredName: string): DetectedFileKind | null;
  /** A storage key that never contains the user's file name. */
  objectKey(scope: string, extension: string, now: Date): string;
}
