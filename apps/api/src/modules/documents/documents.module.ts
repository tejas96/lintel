import {
  type ApplicationStores,
  type ObjectStorage,
  ProjectDocumentAccess,
  ProjectDocumentCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import { detectFileType, generateObjectKey } from '@lintel/integrations';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ENVIRONMENT } from '../../config/configuration.module';
import { CLOCK, OBJECT_STORAGE, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentsController } from './documents.controller';

/** The project document library: upload, list, open and archive. */
@Module({
  imports: [
    // Same limits as task attachments: memory storage, one file, UPLOAD_MAX_BYTES.
    MulterModule.registerAsync({
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => ({
        limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 10, parts: 12 },
      }),
    }),
  ],
  controllers: [DocumentsController, DocumentUploadController],
  providers: [
    {
      provide: ProjectDocumentCommands,
      inject: [UNIT_OF_WORK, CLOCK, OBJECT_STORAGE],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock, storage: ObjectStorage) =>
        new ProjectDocumentCommands({
          uow,
          clock,
          storage,
          inspector: { detect: detectFileType, objectKey: generateObjectKey },
        }),
    },
    {
      provide: ProjectDocumentAccess,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new ProjectDocumentAccess(uow.stores),
    },
  ],
})
export class DocumentsModule {}
