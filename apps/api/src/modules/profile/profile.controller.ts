import { type RequestContext, UpdateOwnProfileCommand } from '@lintel/application';
import { type DatabaseConnection, findOwnProfile } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const contract = apiContract.profile;

/** The signed-in person's own profile: read it, and change name, email and designation. */
@Controller()
export class ProfileController {
  constructor(
    private readonly updateProfile: UpdateOwnProfileCommand,
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
    });
  }
}
