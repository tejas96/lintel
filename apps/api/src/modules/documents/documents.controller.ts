import {
  ProjectDocumentAccess,
  ProjectDocumentCommands,
  type RequestContext,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findProjectDocument,
  listProjectDocuments,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

/** uploadProjectDocument is multipart and has its own single-route handler. */
const { uploadProjectDocument: _upload, ...routes } = apiContract.documents;

/** Listing, opening and archiving project documents. */
@Controller()
export class DocumentsController {
  constructor(
    private readonly commands: ProjectDocumentCommands,
    private readonly access: ProjectDocumentAccess,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    return tsRestHandler(routes, {
      listProjectDocuments: async ({ params, query }) => {
        const reader = await this.access.forProject(context.actor, params.id);
        const library = await listProjectDocuments(db, params.id, reader, query);
        return {
          status: 200,
          body: {
            ...library,
            viewer: {
              canUpload: reader.canUpload,
              canUploadConfidential: reader.canUploadConfidential,
            },
          },
        };
      },
      getDocument: async ({ params }) => {
        const reader = await this.access.forDocument(context.actor, params.id);
        return {
          status: 200,
          body: found(await findProjectDocument(db, params.id, reader), 'Document'),
        };
      },
      archiveDocument: async ({ params, body }) => {
        await this.commands.archive(context, params.id, body);
        const reader = await this.access.forDocument(context.actor, params.id);
        return {
          status: 200,
          body: found(await findProjectDocument(db, params.id, reader), 'Document'),
        };
      },
    });
  }
}
