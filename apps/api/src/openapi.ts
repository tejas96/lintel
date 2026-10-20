import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { generateOpenApi } from '@ts-rest/open-api';
import { apiContract } from './contract';

/** Serves the OpenAPI document generated from the ts-rest contract at /docs. */
export function mountOpenApi(app: INestApplication): void {
  const document = generateOpenApi(
    apiContract,
    {
      info: {
        title: 'Lintel API',
        version: '1.0.0',
        description:
          'Business operations API for interior design and architecture studios. Generated from the shared ts-rest contract.',
      },
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer' },
          sessionCookie: { type: 'apiKey', in: 'cookie', name: 'lintel_session' },
        },
      },
      security: [{ bearer: [] }, { sessionCookie: [] }],
    },
    { setOperationId: 'concatenated-path' },
  );
  SwaggerModule.setup('docs', app, document as Parameters<typeof SwaggerModule.setup>[2], {
    jsonDocumentUrl: 'docs/openapi.json',
  });
}
