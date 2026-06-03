import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { parse } from '../javascript';
import type { ASTResult } from '../../../core/types';

const FIXTURE_PATH = path.resolve(__dirname, './fixtures/javascript.js');

describe('javascript parser', () => {
  let result: ASTResult;

  beforeAll(() => {
    const parsed = parse([FIXTURE_PATH]);

    expect(parsed[FIXTURE_PATH]).toBeDefined();

    result = parsed[FIXTURE_PATH] as ASTResult;

    const expectedSuffix = path.join('fixtures', 'javascript.js');

    expect(result.filePath.endsWith(expectedSuffix)).toBe(true);
  });

  // ---- functions inferred return types ----

  describe('functions inferred return types', () => {
    it('returning number literal resolves to number', () => {
      const fn = result.functions.find((f) => f.name === 'returnsNumber');
      expect(fn?.returnType).toBe('number');
    });

    it('returning string literal resolves to string', () => {
      const fn = result.functions.find((f) => f.name === 'returnsString');
      expect(fn?.returnType).toBe('string');
    });

    it('returning boolean literal resolves to boolean', () => {
      const fn = result.functions.find((f) => f.name === 'returnsBoolean');
      expect(fn?.returnType).toBe('boolean');
    });

    it('returning string concatenation result resolves to string', () => {
      const buildMessage = result.functions.find(
        (f) => f.name === 'buildMessage',
      );
      expect(buildMessage?.returnType).toBe('string');

      const greetArrow = result.functions.find((f) => f.name === 'greetArrow');
      expect(greetArrow?.returnType).toBe('string');
    });

    it('returning addition result on untyped params resolves to any', () => {
      const fn = result.functions.find((f) => f.name === 'addNumbers');
      expect(fn?.returnType).toBe('any');
    });

    it('returning multiplication result resolves to number', () => {
      const fn = result.functions.find((f) => f.name === 'multiplyArrow');
      expect(fn?.returnType).toBe('number');
    });
  });

  // ---- class ----

  describe('class', () => {
    let storeClass: (typeof result.classes)[number] | undefined;

    beforeAll(() => {
      storeClass = result.classes.find((c) => c.name === 'Store');
    });

    it('initialized field type resolved to appropriate type', () => {
      const num = storeClass?.properties.find((p) => p.name === 'count');
      expect(num?.type).toBe('number');

      const str = storeClass?.properties.find((p) => p.name === 'label');
      expect(str?.type).toBe('string');

      const strArr = storeClass?.properties.find((p) => p.name === 'items');
      expect(strArr?.type).toBe('string[]');

      const boo = storeClass?.properties.find((p) => p.name === 'active');
      expect(boo?.type).toBe('boolean');
    });

    it('this.x assignments captured as properties', () => {
      const thisProperty = storeClass?.properties.find(
        (p) => p.name === 'thisProperty',
      );
      expect(thisProperty).toBeDefined();
    });

    it('property declared as field and constructor assignment appears exactly once', () => {
      const count = storeClass?.properties.filter((p) => p.name === 'count');
      expect(count).toHaveLength(1);
    });

    it('method return type after arithmetic on numeric field resolves correctly', () => {
      const increment = storeClass?.methods.find((m) => m.name === 'increment');
      expect(increment?.returnType).toBe('number');
    });
  });
});
