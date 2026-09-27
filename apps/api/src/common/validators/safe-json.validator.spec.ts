import { plainToInstance } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';

import {
  IsSafeJson,
  isSafeJson,
  SAFE_JSON_MAX_BYTES,
  SAFE_JSON_MAX_DEPTH,
} from './safe-json.validator';

class MetadataHolderDto {
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}

const nest = (containers: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let i = 1; i < containers; i += 1) {
    value = { level: value };
  }
  return value;
};

describe('isSafeJson rule set', () => {
  it('accepts plain JSON objects, nested objects, arrays, and primitives', () => {
    expect(isSafeJson({})).toBe(true);
    expect(isSafeJson({ a: 1, b: 'two', c: true, d: null })).toBe(true);
    expect(isSafeJson({ nested: { list: [1, 'x', { deep: false }] } })).toBe(true);
    expect(isSafeJson({ n: 0.5, big: -1e308 })).toBe(true);
  });

  it('rejects top-level values that are not plain objects', () => {
    expect(isSafeJson(null)).toBe(false);
    expect(isSafeJson([])).toBe(false);
    expect(isSafeJson([1, 2])).toBe(false);
    expect(isSafeJson('string')).toBe(false);
    expect(isSafeJson(42)).toBe(false);
    expect(isSafeJson(true)).toBe(false);
    expect(isSafeJson(new Date())).toBe(false);
    expect(isSafeJson(undefined)).toBe(false);
  });

  it('rejects JSON-representability violations at any depth', () => {
    expect(isSafeJson({ fn: () => undefined })).toBe(false);
    expect(isSafeJson({ n: Number.NaN })).toBe(false);
    expect(isSafeJson({ n: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isSafeJson({ b: BigInt(1) })).toBe(false);
    expect(isSafeJson({ u: undefined })).toBe(false);
    expect(isSafeJson({ s: Symbol('x') })).toBe(false);
    expect(isSafeJson({ nested: { fn: () => undefined } })).toBe(false);
    expect(isSafeJson({ list: [undefined] })).toBe(false);
  });

  it('rejects prototype-pollution keys at any depth', () => {
    expect(isSafeJson(JSON.parse('{"__proto__": {"polluted": true}}'))).toBe(false);
    expect(isSafeJson(JSON.parse('{"constructor": {"prototype": {}}}'))).toBe(false);
    expect(isSafeJson(JSON.parse('{"prototype": 1}'))).toBe(false);
    expect(isSafeJson(JSON.parse('{"nested": {"__proto__": {"polluted": true}}}'))).toBe(false);
    expect(isSafeJson(JSON.parse('{"list": [{"constructor": 1}]}'))).toBe(false);
  });

  it('enforces the documented depth limit', () => {
    expect(isSafeJson(nest(SAFE_JSON_MAX_DEPTH))).toBe(true);
    expect(isSafeJson(nest(SAFE_JSON_MAX_DEPTH + 1))).toBe(false);
  });

  it('rejects cyclic structures (depth guard terminates the walk)', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(isSafeJson(cyclic)).toBe(false);
  });

  it('enforces the documented serialized size limit', () => {
    expect(isSafeJson({ blob: 'x'.repeat(100) })).toBe(true);
    expect(
      isSafeJson({ blob: 'x'.repeat(SAFE_JSON_MAX_BYTES + 1) }),
    ).toBe(false);
  });
});

describe('IsSafeJson decorator', () => {
  it('passes when metadata is absent or a plain JSON object', async () => {
    expect(await validate(plainToInstance(MetadataHolderDto, {}))).toHaveLength(0);
    expect(
      await validate(plainToInstance(MetadataHolderDto, { metadata: { origin: 'x' } })),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(MetadataHolderDto, { metadata: { nested: { list: [1, 2] } } }),
      ),
    ).toHaveLength(0);
  });

  it('fails on arrays, primitives, and prototype-pollution payloads with a property-scoped message', async () => {
    for (const invalid of [[1, 2, 3], 'not-an-object', 7]) {
      const errors = await validate(plainToInstance(MetadataHolderDto, { metadata: invalid }));
      const error = errors.find((e) => e.property === 'metadata');
      expect(error).toBeDefined();
      expect(error?.constraints?.isSafeJson).toContain('metadata must be a safe JSON object');
    }

    // plainToInstance strips `__proto__` (class-transformer's own pollution
    // defense), so the payload is assigned post-transform: the validator must
    // still reject it as defense in depth for non-transformer construction paths.
    const dto = plainToInstance(MetadataHolderDto, {});
    dto.metadata = JSON.parse('{"__proto__": {"polluted": true}}');
    const errors = await validate(dto);
    const error = errors.find((e) => e.property === 'metadata');
    expect(error).toBeDefined();
    expect(error?.constraints?.isSafeJson).toContain('metadata must be a safe JSON object');
  });

  it('fails on depth and size violations through the decorator', async () => {
    const deep = await validate(
      plainToInstance(MetadataHolderDto, { metadata: nest(SAFE_JSON_MAX_DEPTH + 1) }),
    );
    expect(deep.find((e) => e.property === 'metadata')).toBeDefined();

    const huge = await validate(
      plainToInstance(MetadataHolderDto, {
        metadata: { blob: 'x'.repeat(SAFE_JSON_MAX_BYTES + 1) },
      }),
    );
    expect(huge.find((e) => e.property === 'metadata')).toBeDefined();
  });
});
