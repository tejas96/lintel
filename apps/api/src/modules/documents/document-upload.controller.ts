import {
  ProjectDocumentAccess,
  ProjectDocumentCommands,
  type RequestContext,
} from '@lintel/application';
import { type DatabaseConnection, findProjectDocument } from '@lintel/database';
import { DOCUMENT_FOLDERS, DOCUMENT_VISIBILITIES } from '@lintel/domain';
import { ValidationFailedError } from '@lintel/shared';
import { Controller, Inject, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { z } from 'zod';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { uploadProjectDocument } = apiContract.documents;

const blankIsMissing = (value: unknown) => (value === '' ? undefined : value);

/** The multipart text fields next to "file". Empty strings count as "not given". */
const documentFieldsSchema = z.object({
  title: z.preprocess(blankIsMissing, z.string().trim().max(200).optional()),
  folder: z.preprocess(blankIsMissing, z.enum(DOCUMENT_FOLDERS).default('other')),
  visibility: z.preprocess(blankIsMissing, z.enum(DOCUMENT_VISIBILITIES).default('project')),
});

interface UploadedFileLike {
  readonly buffer: Buffer;
  readonly originalname: string;
}

/**
 * Single-route handler (it needs Multer's interceptor): multer parses the
 * body with the configured size limit before ts-rest runs. The idempotency
 * interceptor skips multipart requests, so uploads are never replayed.
 */
@Controller()
export class DocumentUploadController {
  constructor(
    private readonly commands: ProjectDocumentCommands,
    private readonly access: ProjectDocumentAccess,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(uploadProjectDocument)
  @UseInterceptors(FileInterceptor('file'))
  upload(@Ctx() context: RequestContext, @UploadedFile() file: UploadedFileLike | undefined) {
    return tsRestHandler(uploadProjectDocument, async ({ params, body }) => {
      if (!file) {
        throw new ValidationFailedError('Attach a file in the "file" field.', [
          { field: 'file', message: 'Choose a file to upload.' },
        ]);
      }
      const fields = documentFieldsSchema.safeParse(body);
      if (!fields.success) {
        throw new ValidationFailedError(
          'Some fields need attention.',
          fields.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }
      const document = await this.commands.add(context, params.id, {
        buffer: file.buffer,
        originalName: file.originalname,
        title: fields.data.title ?? null,
        folder: fields.data.folder,
        visibility: fields.data.visibility,
      });
      const reader = await this.access.forDocument(context.actor, document.id);
      return {
        status: 201,
        body: found(await findProjectDocument(this.database.db, document.id, reader), 'Document'),
      };
    });
  }
}
