import {
  t,
  validateSchema,
  resolveRef,
  resolveType,
} from '../schema';
import type { Schema, Type } from '../schema';
import { v, valueEquals, valueToJSON } from '../value';
import type { Value } from '../value';

// ===========================================================================
// Schema tests
// ===========================================================================

describe('Schema', () => {
  describe('type constructors (t.*)', () => {
    test('primitives', () => {
      expect(t.string()).toEqual({ kind: 'primitive', primitive: 'string' });
      expect(t.bool()).toEqual({ kind: 'primitive', primitive: 'bool' });
      expect(t.int32()).toEqual({ kind: 'primitive', primitive: 'int32' });
      expect(t.int64()).toEqual({ kind: 'primitive', primitive: 'int64' });
      expect(t.uint32()).toEqual({ kind: 'primitive', primitive: 'uint32' });
      expect(t.uint64()).toEqual({ kind: 'primitive', primitive: 'uint64' });
      expect(t.float32()).toEqual({ kind: 'primitive', primitive: 'float32' });
      expect(t.float64()).toEqual({ kind: 'primitive', primitive: 'float64' });
      expect(t.bytes()).toEqual({ kind: 'primitive', primitive: 'bytes' });
    });

    test('product', () => {
      const person = t.product({
        name: t.field(t.string()),
        age: t.field(t.int32()),
      });

      expect(person.kind).toBe('product');
      expect(Object.keys(person.fields)).toEqual(['name', 'age']);
      expect(person.fields['name'].type).toEqual(t.string());
      expect(person.fields['age'].type).toEqual(t.int32());
    });

    test('product with metadata', () => {
      const msg = t.product({
        id: t.field(t.uint32(), { number: 1 }),
        name: t.field(t.string(), { number: 2, deprecated: true }),
      });

      expect(msg.fields['id'].number).toBe(1);
      expect(msg.fields['name'].deprecated).toBe(true);
    });

    test('sum', () => {
      const shape = t.sum({
        Circle: t.variant(t.float64()),
        Rectangle: t.variant(
          t.product({
            width: t.field(t.float64()),
            height: t.field(t.float64()),
          })
        ),
        Point: t.variant(), // data-less
      });

      expect(shape.kind).toBe('sum');
      expect(Object.keys(shape.variants)).toEqual([
        'Circle',
        'Rectangle',
        'Point',
      ]);
      expect(shape.variants['Circle'].payload).toEqual(t.float64());
      expect(shape.variants['Point'].payload).toBeUndefined();
    });

    test('list and map', () => {
      const list = t.list(t.string());
      expect(list).toEqual({ kind: 'list', element: t.string() });

      const map = t.map(t.string(), t.int32());
      expect(map).toEqual({ kind: 'map', key: t.string(), value: t.int32() });
    });

    test('optional', () => {
      const opt = t.optional(t.string());
      expect(opt).toEqual({ kind: 'optional', inner: t.string() });
    });

    test('ref', () => {
      const ref = t.ref('Person');
      expect(ref).toEqual({ kind: 'ref', name: 'Person' });
    });
  });

  describe('resolveRef', () => {
    const schema: Schema = {
      definitions: {
        Person: t.product({
          name: t.field(t.string()),
        }),
      },
    };

    test('resolves existing definition', () => {
      const resolved = resolveRef(schema, 'Person');
      expect(resolved).toBeDefined();
      expect(resolved!.kind).toBe('product');
    });

    test('returns undefined for missing definition', () => {
      expect(resolveRef(schema, 'Unknown')).toBeUndefined();
    });
  });

  describe('resolveType', () => {
    const schema: Schema = {
      definitions: {
        UserId: t.uint32(),
        NameRef: t.ref('UserName'),
        UserName: t.string(),
      },
    };

    test('returns non-ref types unchanged', () => {
      const result = resolveType(schema, t.string());
      expect(result).toEqual(t.string());
    });

    test('follows single ref', () => {
      const result = resolveType(schema, t.ref('UserId'));
      expect(result).toEqual(t.uint32());
    });

    test('follows chain of refs', () => {
      const result = resolveType(schema, t.ref('NameRef'));
      expect(result).toEqual(t.string());
    });

    test('returns undefined for dangling ref', () => {
      const result = resolveType(schema, t.ref('Missing'));
      expect(result).toBeUndefined();
    });

    test('returns undefined for cyclic refs', () => {
      const cyclicSchema: Schema = {
        definitions: {
          A: t.ref('B'),
          B: t.ref('A'),
        },
      };
      const result = resolveType(cyclicSchema, t.ref('A'));
      expect(result).toBeUndefined();
    });
  });

  describe('validateSchema', () => {
    test('valid schema returns no errors', () => {
      const schema: Schema = {
        definitions: {
          Person: t.product({
            name: t.field(t.string()),
            address: t.field(t.ref('Address')),
          }),
          Address: t.product({
            street: t.field(t.string()),
            city: t.field(t.string()),
          }),
        },
        root: 'Person',
      };

      expect(validateSchema(schema)).toEqual([]);
    });

    test('detects dangling ref in product field', () => {
      const schema: Schema = {
        definitions: {
          Person: t.product({
            address: t.field(t.ref('Address')),
          }),
        },
      };

      const errors = validateSchema(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Address');
    });

    test('detects dangling ref in sum variant', () => {
      const schema: Schema = {
        definitions: {
          Shape: t.sum({
            Circle: t.variant(t.ref('CircleData')),
          }),
        },
      };

      const errors = validateSchema(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('CircleData');
    });

    test('detects dangling root', () => {
      const schema: Schema = {
        definitions: {},
        root: 'Nonexistent',
      };

      const errors = validateSchema(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Nonexistent');
    });

    test('validates nested types (list, map, optional)', () => {
      const schema: Schema = {
        definitions: {
          Foo: t.product({
            items: t.field(t.list(t.ref('Missing1'))),
            lookup: t.field(t.map(t.string(), t.ref('Missing2'))),
            maybe: t.field(t.optional(t.ref('Missing3'))),
          }),
        },
      };

      const errors = validateSchema(schema);
      expect(errors).toHaveLength(3);
    });
  });

  describe('recursive types', () => {
    test('linked list schema is valid', () => {
      const schema: Schema = {
        definitions: {
          IntList: t.product({
            value: t.field(t.int32()),
            next: t.field(t.optional(t.ref('IntList'))),
          }),
        },
        root: 'IntList',
      };

      expect(validateSchema(schema)).toEqual([]);
    });

    test('tree schema is valid', () => {
      const schema: Schema = {
        definitions: {
          Tree: t.sum({
            Leaf: t.variant(t.int32()),
            Branch: t.variant(
              t.product({
                left: t.field(t.ref('Tree')),
                right: t.field(t.ref('Tree')),
              })
            ),
          }),
        },
        root: 'Tree',
      };

      expect(validateSchema(schema)).toEqual([]);
    });
  });
});

// ===========================================================================
// Value tests
// ===========================================================================

describe('Value', () => {
  describe('value constructors (v.*)', () => {
    test('primitives', () => {
      expect(v.string('hello')).toEqual({ kind: 'string', value: 'hello' });
      expect(v.bool(true)).toEqual({ kind: 'bool', value: true });
      expect(v.int(42)).toEqual({ kind: 'int', value: 42 });
      expect(v.float(3.14)).toEqual({ kind: 'float', value: 3.14 });
      expect(v.null()).toEqual({ kind: 'null' });
    });

    test('bytes', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const val = v.bytes(bytes);
      expect(val.kind).toBe('bytes');
      expect(val.value).toBe(bytes);
    });

    test('product', () => {
      const person = v.product({
        name: v.string('Alice'),
        age: v.int(30),
      });

      expect(person.kind).toBe('product');
      expect(person.fields['name']).toEqual(v.string('Alice'));
      expect(person.fields['age']).toEqual(v.int(30));
    });

    test('sum', () => {
      const circle = v.sum('Circle', v.float(5.0));
      expect(circle.kind).toBe('sum');
      expect(circle.tag).toBe('Circle');
      expect(circle.payload).toEqual(v.float(5.0));

      const point = v.sum('Point');
      expect(point.payload).toBeNull();
    });

    test('list', () => {
      const list = v.list([v.int(1), v.int(2), v.int(3)]);
      expect(list.kind).toBe('list');
      expect(list.elements).toHaveLength(3);
    });

    test('map', () => {
      const map = v.map([
        [v.string('a'), v.int(1)],
        [v.string('b'), v.int(2)],
      ]);
      expect(map.kind).toBe('map');
      expect(map.entries).toHaveLength(2);
    });
  });

  describe('valueEquals', () => {
    test('equal primitives', () => {
      expect(valueEquals(v.string('hi'), v.string('hi'))).toBe(true);
      expect(valueEquals(v.bool(true), v.bool(true))).toBe(true);
      expect(valueEquals(v.int(42), v.int(42))).toBe(true);
      expect(valueEquals(v.float(1.5), v.float(1.5))).toBe(true);
      expect(valueEquals(v.null(), v.null())).toBe(true);
    });

    test('unequal primitives', () => {
      expect(valueEquals(v.string('a'), v.string('b'))).toBe(false);
      expect(valueEquals(v.int(1), v.int(2))).toBe(false);
      expect(valueEquals(v.bool(true), v.bool(false))).toBe(false);
    });

    test('different kinds', () => {
      expect(valueEquals(v.string('1'), v.int(1))).toBe(false);
      expect(valueEquals(v.null(), v.int(0))).toBe(false);
    });

    test('bytes equality', () => {
      expect(
        valueEquals(
          v.bytes(new Uint8Array([1, 2, 3])),
          v.bytes(new Uint8Array([1, 2, 3]))
        )
      ).toBe(true);

      expect(
        valueEquals(
          v.bytes(new Uint8Array([1, 2, 3])),
          v.bytes(new Uint8Array([1, 2, 4]))
        )
      ).toBe(false);

      expect(
        valueEquals(
          v.bytes(new Uint8Array([1, 2])),
          v.bytes(new Uint8Array([1, 2, 3]))
        )
      ).toBe(false);
    });

    test('product equality', () => {
      const a = v.product({ x: v.int(1), y: v.int(2) });
      const b = v.product({ x: v.int(1), y: v.int(2) });
      const c = v.product({ x: v.int(1), y: v.int(3) });
      const d = v.product({ x: v.int(1) });

      expect(valueEquals(a, b)).toBe(true);
      expect(valueEquals(a, c)).toBe(false);
      expect(valueEquals(a, d)).toBe(false);
    });

    test('sum equality', () => {
      expect(
        valueEquals(v.sum('A', v.int(1)), v.sum('A', v.int(1)))
      ).toBe(true);
      expect(
        valueEquals(v.sum('A', v.int(1)), v.sum('B', v.int(1)))
      ).toBe(false);
      expect(
        valueEquals(v.sum('A', v.int(1)), v.sum('A', v.int(2)))
      ).toBe(false);
      expect(valueEquals(v.sum('A'), v.sum('A'))).toBe(true);
      expect(
        valueEquals(v.sum('A'), v.sum('A', v.int(1)))
      ).toBe(false);
    });

    test('list equality', () => {
      const a = v.list([v.int(1), v.int(2)]);
      const b = v.list([v.int(1), v.int(2)]);
      const c = v.list([v.int(1), v.int(3)]);
      const d = v.list([v.int(1)]);

      expect(valueEquals(a, b)).toBe(true);
      expect(valueEquals(a, c)).toBe(false);
      expect(valueEquals(a, d)).toBe(false);
    });

    test('nested equality', () => {
      const a = v.product({
        items: v.list([v.product({ x: v.int(1) })]),
        kind: v.sum('Foo', v.string('bar')),
      });
      const b = v.product({
        items: v.list([v.product({ x: v.int(1) })]),
        kind: v.sum('Foo', v.string('bar')),
      });

      expect(valueEquals(a, b)).toBe(true);
    });
  });

  describe('valueToJSON', () => {
    test('primitives', () => {
      expect(valueToJSON(v.string('hello'))).toBe('hello');
      expect(valueToJSON(v.bool(true))).toBe(true);
      expect(valueToJSON(v.int(42))).toBe(42);
      expect(valueToJSON(v.float(3.14))).toBe(3.14);
      expect(valueToJSON(v.null())).toBeNull();
    });

    test('product', () => {
      const result = valueToJSON(
        v.product({
          name: v.string('Alice'),
          age: v.int(30),
        })
      );

      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    test('sum', () => {
      expect(valueToJSON(v.sum('Circle', v.float(5.0)))).toEqual({
        Circle: 5.0,
      });
      expect(valueToJSON(v.sum('Point'))).toEqual({ Point: null });
    });

    test('list', () => {
      const result = valueToJSON(v.list([v.int(1), v.int(2), v.int(3)]));
      expect(result).toEqual([1, 2, 3]);
    });

    test('nested structure', () => {
      const result = valueToJSON(
        v.product({
          name: v.string('Team'),
          members: v.list([
            v.product({ name: v.string('Alice'), active: v.bool(true) }),
            v.product({ name: v.string('Bob'), active: v.bool(false) }),
          ]),
        })
      );

      expect(result).toEqual({
        name: 'Team',
        members: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
      });
    });
  });
});
