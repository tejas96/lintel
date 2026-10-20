import { ManageTemplatesCommands, type RequestContext } from '@lintel/application';
import { type DatabaseConnection, findTemplateDetail, listTemplates } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';
import { toWorkflowDefinition } from './workflow-definition.mapper';

const contract = apiContract.templates;

/** Workflow templates: anyone signed in can read; `templates.manage` writes. */
@Controller()
export class TemplatesController {
  constructor(
    private readonly commands: ManageTemplatesCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async detail(templateId: string) {
    return found(await findTemplateDetail(this.database.db, templateId), 'Template');
  }

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      listTemplates: async ({ query }) => ({
        status: 200,
        body: await listTemplates(this.database.db, query),
      }),
      getTemplate: async ({ params }) => ({ status: 200, body: await this.detail(params.id) }),
      createTemplate: async ({ body }) => {
        const { id } = await this.commands.create(context, body);
        return { status: 201, body: await this.detail(id) };
      },
      saveDraft: async ({ params, body }) => {
        await this.commands.saveDraft(context, params.id, {
          definition: toWorkflowDefinition(body.definition),
          changeNotes: body.changeNotes,
          expectedVersion: body.version,
        });
        return { status: 200, body: await this.detail(params.id) };
      },
      publishDraft: async ({ params, body }) => {
        await this.commands.publish(context, params.id, body.version);
        return { status: 200, body: await this.detail(params.id) };
      },
      archiveTemplate: async ({ params }) => {
        await this.commands.archive(context, params.id);
        return { status: 200, body: await this.detail(params.id) };
      },
    });
  }
}
