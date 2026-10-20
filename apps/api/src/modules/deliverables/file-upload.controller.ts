import { idSchema } from '@lintel/api-contracts';
import { FileCommands, type RequestContext } from '@lintel/application';
import { type DatabaseConnection, findFileSummary } from '@lintel/database';
import { ValidationFailedError } from '@lintel/shared';
import { Controller, Inject, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { z } from 'zod';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { uploadFile } = apiContract.deliverables;

/** The multipart text fields next to "file". Empty strings count as "not given". */
const uploadFieldsSchema = z.object({
  projectId: z.preprocess((value) => (value === '' ? undefined : value), idSchema.optional()),
  visibility: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['project', 'confidential']).optional(),
  ),
});

/** What multer's memory storage hands us (the subset we use). */
interface UploadedFileLike {
  readonly buffer: Buffer;
  readonly originalname: string;
}

/**
 * Single-route handler: Multer (memory storage, size limit from
 * UPLOAD_MAX_BYTES via MulterModule) parses the body before ts-rest runs.
 */
@Controller()
export class FileUploadController {
  constructor(
    private readonly files: FileCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(uploadFile)
  @UseInterceptors(FileInterceptor('file'))
  upload(@Ctx() context: RequestContext, @UploadedFile() file: UploadedFileLike | undefined) {
    return tsRestHandler(uploadFile, async ({ body }) => {
      if (!file) {
        throw new ValidationFailedError('Attach a file in the "file" field.', [
          { field: 'file', message: 'Choose a file to upload.' },
        ]);
      }
      const fields = uploadFieldsSchema.safeParse(body);
      if (!fields.success) {
        throw new ValidationFailedError(
          'Some fields need attention.',
          fields.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }
      const record = await this.files.upload(context, {
        buffer: file.buffer,
        originalName: file.originalname,
        projectId: fields.data.projectId ?? null,
        visibility: fields.data.visibility ?? null,
      });
      return {
        status: 201,
        body: found(await findFileSummary(this.database.db, record.id), 'File'),
      };
    });
  }
}
