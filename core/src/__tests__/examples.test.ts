/**
 * Tests that validate the example schemas compile, type-check,
 * and pass schema validation. Also tests creating sample values
 * to confirm the schema+value system works for real-world formats.
 */

import { validateSchema } from '../schema';
import type { Annotations } from '../schema';
import { v, valueToJSON } from '../value';
import { dockerfileSchema, dockerfileAnnotations, ids as d } from '../examples/dockerfile';
import { cargoTomlSchema, cargoTomlAnnotations } from '../examples/cargo-toml';

describe('Example schemas', () => {
  describe('Dockerfile schema', () => {
    test('is valid', () => {
      expect(validateSchema(dockerfileSchema)).toEqual([]);
    });

    test('root points to a defined type', () => {
      expect(dockerfileSchema.root).toBeDefined();
      expect(dockerfileSchema.definitions[dockerfileSchema.root!]).toBeDefined();
    });

    test('defines Instruction and Mount types', () => {
      expect(dockerfileSchema.definitions[d.TY_INSTRUCTION]).toBeDefined();
      expect(dockerfileSchema.definitions[d.TY_MOUNT]).toBeDefined();
    });

    test('annotations cover all definition keys', () => {
      for (const key of Object.keys(dockerfileSchema.definitions)) {
        expect(dockerfileAnnotations[key]).toBeDefined();
      }
    });

    test('sample Dockerfile value is representable', () => {
      const dockerfile = v.list([
        v.sum(d.V_FROM, v.product({
          [d.F_FROM_IMAGE]: v.string('ubuntu:22.04'),
          [d.F_FROM_AS]: v.string('base'),
          [d.F_FROM_PLATFORM]: v.null(),
        })),
        v.sum(d.V_RUN, v.product({
          [d.F_RUN_COMMAND]: v.string('apt-get update && apt-get install -y curl'),
          [d.F_RUN_MOUNT]: v.null(),
        })),
        v.sum(d.V_COPY, v.product({
          [d.F_COPY_SRC]: v.list([v.string('/app')]),
          [d.F_COPY_DST]: v.string('/app'),
          [d.F_COPY_FROM]: v.string('build'),
          [d.F_COPY_CHOWN]: v.null(),
          [d.F_COPY_CHMOD]: v.null(),
        })),
        v.sum(d.V_ENV, v.product({
          [d.F_ENV_VARS]: v.map([
            [v.string('NODE_ENV'), v.string('production')],
            [v.string('PORT'), v.string('8080')],
          ]),
        })),
        v.sum(d.V_CMD, v.product({
          [d.F_CMD_ARGS]: v.list([v.string('./app'), v.string('--port'), v.string('8080')]),
        })),
      ]);

      const json = valueToJSON(dockerfile) as any[];
      expect(json).toHaveLength(5);
      // Tags are now opaque IDs, but JSON still uses them as keys
      expect(json[0]).toHaveProperty(d.V_FROM);
      expect(json[1]).toHaveProperty(d.V_RUN);
      expect(json[3]).toHaveProperty(d.V_ENV);
      expect(json[4]).toHaveProperty(d.V_CMD);
    });
  });

  describe('Cargo.toml schema', () => {
    test('is valid', () => {
      expect(validateSchema(cargoTomlSchema)).toEqual([]);
    });

    test('root points to a defined type', () => {
      expect(cargoTomlSchema.root).toBeDefined();
      expect(cargoTomlSchema.definitions[cargoTomlSchema.root!]).toBeDefined();
    });

    test('has annotation for every definition', () => {
      for (const key of Object.keys(cargoTomlSchema.definitions)) {
        expect(cargoTomlAnnotations[key]).toBeDefined();
      }
    });

    test('annotations have human-readable names', () => {
      // Spot-check that a few annotations have sensible names
      const rootAnnotation = cargoTomlAnnotations[cargoTomlSchema.root!];
      expect(rootAnnotation).toBeDefined();
      expect(rootAnnotation.name).toBe('CargoToml');
    });
  });
});
