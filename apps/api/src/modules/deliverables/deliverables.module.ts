import {
  type ApplicationStores,
  DeliverableCommands,
  DeliverableViewerQuery,
  FileCommands,
  type ObjectStorage,
  type OperationsDependencies,
  ReviewDeliverableCommand,
  SiteUpdateCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import { detectFileType, generateObjectKey } from '@lintel/integrations';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ENVIRONMENT } from '../../config/configuration.module';
import { OBJECT_STORAGE, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { OPERATIONS_DEPENDENCIES, operationsUseCase } from '../tasks/operations.providers';
import { TasksModule } from '../tasks/tasks.module';
import { DeliverablesController } from './deliverables.controller';
import { FileContentController } from './file-content.controller';
import { FileUploadController } from './file-upload.controller';

@Module({
  imports: [
    TasksModule,
    // Memory storage (multer's default) with the configured size limit; one file per request.
    MulterModule.registerAsync({
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => ({
        limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 10, parts: 12 },
      }),
    }),
  ],
  controllers: [DeliverablesController, FileUploadController, FileContentController],
  providers: [
    operationsUseCase(DeliverableCommands),
    operationsUseCase(ReviewDeliverableCommand),
    operationsUseCase(SiteUpdateCommands),
    {
      provide: FileCommands,
      inject: [OPERATIONS_DEPENDENCIES, OBJECT_STORAGE],
      useFactory: (deps: OperationsDependencies, storage: ObjectStorage) =>
        new FileCommands(deps, storage, {
          detect: detectFileType,
          objectKey: generateObjectKey,
        }),
    },
    {
      provide: DeliverableViewerQuery,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new DeliverableViewerQuery(uow.stores),
    },
  ],
})
export class DeliverablesModule {}
