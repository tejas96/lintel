import {
  GuidanceCommands,
  type RequestContext,
  UpdateOwnProfileCommand,
} from '@lintel/application';
import { type DatabaseConnection, findOwnProfile } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const contract = apiContract.profile;

/**
 * The signed-in person's own profile (name, email, designation) and their
 * first-run tips, remembered per person so each shows once on every device.
 */
@Controller()
export class ProfileController {
  constructor(
    private readonly updateProfile: UpdateOwnProfileCommand,
    private readonly guidance: GuidanceCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    const profile = async () =>
      found(await findOwnProfile(this.database.db, context.actor.userId), 'Your profile');
    return tsRestHandler(contract, {
      getMyProfile: async () => ({ status: 200, body: await profile() }),
      updateMyProfile: async ({ body }) => {
        const { version, ...changes } = body;
        await this.updateProfile.execute(context, { version, changes });
        return { status: 200, body: await profile() };
      },
      getMyGuidance: async () => ({ status: 200, body: await this.guidance.list(context) }),
      markGuidanceSeen: async ({ params }) => ({
        status: 200,
        body: await this.guidance.markSeen(context, params.tip),
      }),
      resetGuidance: async () => ({ status: 200, body: await this.guidance.showAgain(context) }),
    });
  }
}
