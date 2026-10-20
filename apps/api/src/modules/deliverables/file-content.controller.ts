import { pipeline } from 'node:stream/promises';
import { idSchema } from '@lintel/api-contracts';
import {
  FileCommands,
  isImageContentType,
  type ObjectStorage,
  type RequestContext,
} from '@lintel/application';
import { safeDownloadName } from '@lintel/integrations';
import { DependencyUnavailableError, NotFoundError } from '@lintel/shared';
import { Controller, Get, Inject, Logger, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Ctx } from '../../common/auth/auth.decorators';
import { OBJECT_STORAGE } from '../../infrastructure/tokens';

/** RFC 6266 header with an ASCII fallback and the UTF-8 name for modern clients. */
export function contentDisposition(originalName: string, inline: boolean): string {
  const safe = safeDownloadName(originalName);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/**
 * GET /v1/files/:id/content — streams a stored file.
 *
 * A plain Nest route outside the ts-rest contract because the response is
 * binary. The global SessionGuard accepts both the web session cookie and the
 * mobile bearer token (GET needs no CSRF header). Authorisation: project files
 * need project access; confidential files also need the project manager or
 * `files.view_confidential`; private and unscoped files only their uploader.
 * Missing and forbidden both answer 404. Images are served inline, everything
 * else as an attachment, always with `nosniff`.
 */
@Controller('v1/files')
export class FileContentController {
  private readonly logger = new Logger(FileContentController.name);

  constructor(
    private readonly files: FileCommands,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get(':id/content')
  async content(
    @Ctx() context: RequestContext,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!idSchema.safeParse(id).success) throw new NotFoundError('File');
    const file = await this.files.authorizeDownload(context.actor, id);
    const object = await this.storage.getObject(file.storageKey).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        this.logger.warn(`File ${file.id} has metadata but no stored object.`);
        throw new NotFoundError('File');
      }
      throw new DependencyUnavailableError('File storage is not reachable. Try again shortly.');
    });
    response.status(200);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', String(file.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      contentDisposition(file.originalName, isImageContentType(file.contentType)),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, max-age=300');
    // Lets the web app (same site, other port/subdomain) embed images; helmet defaults to same-origin.
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    try {
      await pipeline(object.body, response);
    } catch (error) {
      this.logger.warn(
        `Streaming file ${file.id} stopped: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      response.destroy();
    }
  }
}
