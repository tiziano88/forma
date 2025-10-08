/**
 * Standalone test: load the Dockerfile schema, validate it,
 * create a nontrivial multi-stage Dockerfile, and pretty-print the result.
 */

import { validateSchema } from '../schema';
import { v, valueToJSON } from '../value';
import { dockerfileSchema, dockerfileAnnotations, ids as d } from '../examples/dockerfile';

describe('Dockerfile schema — nontrivial multi-stage build', () => {
  test('schema validates', () => {
    const errors = validateSchema(dockerfileSchema);
    expect(errors).toEqual([]);
    console.log('✅ Dockerfile schema validated, 0 errors');
    console.log(`   ${Object.keys(dockerfileSchema.definitions).length} type definitions`);
  });

  test('annotations cover all types and variants', () => {
    // Check all definition keys have annotations
    for (const key of Object.keys(dockerfileSchema.definitions)) {
      expect(dockerfileAnnotations[key]).toBeDefined();
      expect(dockerfileAnnotations[key].name).toBeTruthy();
    }

    // Check instruction variants have annotations
    const instruction = dockerfileSchema.definitions[d.TY_INSTRUCTION];
    expect(instruction.kind).toBe('sum');
    if (instruction.kind === 'sum') {
      for (const key of Object.keys(instruction.variants)) {
        expect(dockerfileAnnotations[key]).toBeDefined();
      }
    }
  });

  test('multi-stage Node.js production Dockerfile', () => {
    const dockerfile = v.list([
      // Stage 1: deps
      v.sum(d.V_FROM, v.product({
        [d.F_FROM_IMAGE]: v.string('node:20-alpine'),
        [d.F_FROM_AS]: v.string('deps'),
        [d.F_FROM_PLATFORM]: v.string('linux/amd64'),
      })),
      v.sum(d.V_WORKDIR, v.product({
        [d.F_WORKDIR_PATH]: v.string('/app'),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('package.json'), v.string('pnpm-lock.yaml')]),
        [d.F_COPY_DST]: v.string('./'),
        [d.F_COPY_FROM]: v.null(),
        [d.F_COPY_CHOWN]: v.null(),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_RUN, v.product({
        [d.F_RUN_COMMAND]: v.string('pnpm install --frozen-lockfile'),
        [d.F_RUN_MOUNT]: v.list([
          v.sum(d.V_MOUNT_CACHE, v.product({
            [d.F_CACHE_TARGET]: v.string('/root/.local/share/pnpm/store'),
            [d.F_CACHE_SHARING]: v.string('shared'),
          })),
        ]),
      })),

      // Stage 2: builder
      v.sum(d.V_FROM, v.product({
        [d.F_FROM_IMAGE]: v.string('node:20-alpine'),
        [d.F_FROM_AS]: v.string('builder'),
        [d.F_FROM_PLATFORM]: v.null(),
      })),
      v.sum(d.V_WORKDIR, v.product({
        [d.F_WORKDIR_PATH]: v.string('/app'),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('/app/node_modules')]),
        [d.F_COPY_DST]: v.string('./node_modules'),
        [d.F_COPY_FROM]: v.string('deps'),
        [d.F_COPY_CHOWN]: v.null(),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('.')]),
        [d.F_COPY_DST]: v.string('.'),
        [d.F_COPY_FROM]: v.null(),
        [d.F_COPY_CHOWN]: v.null(),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_ARG, v.product({
        [d.F_ARG_NAME]: v.string('NEXT_PUBLIC_API_URL'),
        [d.F_ARG_DEFAULT]: v.null(),
      })),
      v.sum(d.V_ENV, v.product({
        [d.F_ENV_VARS]: v.map([
          [v.string('NODE_ENV'), v.string('production')],
        ]),
      })),
      v.sum(d.V_RUN, v.product({
        [d.F_RUN_COMMAND]: v.string('pnpm build'),
        [d.F_RUN_MOUNT]: v.null(),
      })),

      // Stage 3: runner (distroless)
      v.sum(d.V_FROM, v.product({
        [d.F_FROM_IMAGE]: v.string('gcr.io/distroless/nodejs20-debian12'),
        [d.F_FROM_AS]: v.string('runner'),
        [d.F_FROM_PLATFORM]: v.null(),
      })),
      v.sum(d.V_WORKDIR, v.product({
        [d.F_WORKDIR_PATH]: v.string('/app'),
      })),
      v.sum(d.V_LABEL, v.product({
        [d.F_LABEL_LABELS]: v.map([
          [v.string('org.opencontainers.image.source'), v.string('https://github.com/example/app')],
          [v.string('maintainer'), v.string('team@example.com')],
        ]),
      })),
      v.sum(d.V_ENV, v.product({
        [d.F_ENV_VARS]: v.map([
          [v.string('NODE_ENV'), v.string('production')],
          [v.string('PORT'), v.string('8080')],
        ]),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('/app/.next/standalone')]),
        [d.F_COPY_DST]: v.string('./'),
        [d.F_COPY_FROM]: v.string('builder'),
        [d.F_COPY_CHOWN]: v.string('nonroot:nonroot'),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('/app/public')]),
        [d.F_COPY_DST]: v.string('./public'),
        [d.F_COPY_FROM]: v.string('builder'),
        [d.F_COPY_CHOWN]: v.null(),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_COPY, v.product({
        [d.F_COPY_SRC]: v.list([v.string('/app/.next/static')]),
        [d.F_COPY_DST]: v.string('./.next/static'),
        [d.F_COPY_FROM]: v.string('builder'),
        [d.F_COPY_CHOWN]: v.null(),
        [d.F_COPY_CHMOD]: v.null(),
      })),
      v.sum(d.V_USER, v.product({
        [d.F_USER_USER]: v.string('nonroot'),
        [d.F_USER_GROUP]: v.null(),
      })),
      v.sum(d.V_EXPOSE, v.product({
        [d.F_EXPOSE_PORT]: v.int(8080),
        [d.F_EXPOSE_PROTO]: v.string('tcp'),
      })),
      v.sum(d.V_HEALTHCHECK, v.product({
        [d.F_HC_COMMAND]: v.string('curl -f http://localhost:8080/healthz'),
        [d.F_HC_INTERVAL]: v.string('30s'),
        [d.F_HC_TIMEOUT]: v.string('5s'),
        [d.F_HC_RETRIES]: v.int(3),
      })),
      v.sum(d.V_ENTRYPOINT, v.product({
        [d.F_ENTRY_ARGS]: v.list([v.string('node'), v.string('server.js')]),
      })),
    ]);

    // Validate structure
    const json = valueToJSON(dockerfile) as any[];
    expect(json).toHaveLength(22);

    // Check stages — FROM instructions use opaque variant IDs as JSON keys
    const fromInstructions = json.filter((i: any) => d.V_FROM in i);
    expect(fromInstructions).toHaveLength(3);

    // Check copy with --from (using opaque field IDs)
    const copiesWithFrom = json.filter(
      (i: any) => d.V_COPY in i && i[d.V_COPY][d.F_COPY_FROM] !== null
    );
    expect(copiesWithFrom).toHaveLength(4); // deps→builder, builder→runner (3 copies)

    // Annotations provide the human-readable names
    expect(dockerfileAnnotations[d.V_FROM].name).toBe('FROM');
    expect(dockerfileAnnotations[d.V_HEALTHCHECK].name).toBe('HEALTHCHECK');
    expect(dockerfileAnnotations[d.F_HC_RETRIES].name).toBe('retries');

    console.log('\n📄 Multi-stage Dockerfile (22 instructions, 3 stages)');
    console.log('   All assertions pass with opaque IDs');
  });
});
