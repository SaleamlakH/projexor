import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { parse } from '../typescript';
import type { ASTResult } from '../../../core/types';

const FIXTURE_PATH = path.resolve(__dirname, './fixtures/typescript.ts');

describe('typescript parser', () => {
  let result: ASTResult;

  beforeAll(() => {
    const parsed = parse([FIXTURE_PATH]);

    expect(parsed[FIXTURE_PATH]).toBeDefined();

    result = parsed[FIXTURE_PATH] as ASTResult;

    const expectedSuffix = path.join('fixtures', 'typescript.ts');

    expect(result.filePath.endsWith(expectedSuffix)).toBe(true);
    expect(result.lines).toBe(116);
    expect(result.supported).toBe(true);
  });

  // ---- imports ----

  describe('imports', () => {
    it('correct number of imports extracted', () => {
      expect(result.imports).toHaveLength(7);
    });

    it('capture single line named import', () => {
      const imp = result.imports.find((i) => i.name === 'readFile');
      expect(imp).toMatchObject({
        name: 'readFile',
        source: 'fs',
        line: 4,
      });
    });

    it('captures each specifiers of multiline named import', () => {
      const join = result.imports.find((i) => i.name === 'join');
      expect(join).toMatchObject({ name: 'join', source: 'path', line: 8 });

      const resolve = result.imports.find((i) => i.name === 'resolve');
      expect(resolve).toMatchObject({
        name: 'resolve',
        source: 'path',
        line: 9,
      });
    });

    it('capture default imports', () => {
      const imp = result.imports.find((i) => i.name === 'defaultExport');
      expect(imp).toMatchObject({
        name: 'defaultExport',
        source: './default',
        line: 12,
      });
    });

    it('aliased import name uses original as local format', () => {
      const imp = result.imports.find((i) => i.name === 'User as UserModel');
      expect(imp).toMatchObject({
        name: 'User as UserModel',
        source: './models',
        line: 11,
      });
    });

    it('capture namespace import with local name', () => {
      const imp = result.imports.find((i) => i.name === 'utils');
      expect(imp).toMatchObject({
        name: 'utils',
        source: './utils',
        line: 13,
      });
    });

    it('captures side effect with empty string name', () => {
      const imp = result.imports.find((i) => i.source === './side-effect');
      expect(imp).toMatchObject({
        name: '',
        source: './side-effect',
        line: 14,
      });
    });
  });

  // ---- exports ----

  describe('exports', () => {
    it('correct number of exports extracted', () => {
      expect(result.exports).toHaveLength(11);
    });

    it('captures default export correctly', () => {
      const exp = result.exports.find((e) => e.type === 'default');
      expect(exp).toMatchObject({
        name: 'defaultExport',
        type: 'default',
        line: 25,
      });
    });

    it('captures each specifier of multiline export', () => {
      const fn = result.exports.find((e) => e.name === 'namedExportFn');
      const cls = result.exports.find((e) => e.name === 'NamedExportClass');
      const vbl = result.exports.find((e) => e.name === 'NAMED_EXPORT_VAR');

      expect(fn).toMatchObject({
        name: 'namedExportFn',
        type: 'function',
        line: 20,
      });
      expect(cls).toMatchObject({
        name: 'NamedExportClass',
        type: 'class',
        line: 21,
      });
      expect(vbl).toMatchObject({
        name: 'NAMED_EXPORT_VAR',
        type: 'variable',
        line: 22,
      });
    });

    it('aliased export name uses original as local format', () => {
      const exp = result.exports.find((e) => e.name === 'join as joinPath');
      expect(exp).toMatchObject({
        name: 'join as joinPath',
        type: 'variable',
        line: 24,
      });
    });

    it('variables exports captured with variable type', () => {
      const apiUrl = result.exports.find((e) => e.name === 'API_URL');
      const maxRetries = result.exports.find((e) => e.name === 'MAX_RETRIES');
      expect(apiUrl).toMatchObject({
        name: 'API_URL',
        type: 'variable',
        line: 29,
      });
      expect(maxRetries).toMatchObject({
        name: 'MAX_RETRIES',
        type: 'variable',
        line: 30,
      });
    });

    it('export modifier on function declarations captured correctly', () => {
      const fetchUser = result.exports.find((e) => e.name === 'fetchUser');
      const syncData = result.exports.find((e) => e.name === 'syncData');
      expect(fetchUser).toMatchObject({
        name: 'fetchUser',
        type: 'function',
        line: 41,
      });
      expect(syncData).toMatchObject({
        name: 'syncData',
        type: 'function',
        line: 60,
      });
    });

    it('export modifier on arrow function captured correctly', () => {
      const buildQuery = result.exports.find((e) => e.name === 'buildQuery');
      expect(buildQuery).toMatchObject({
        name: 'buildQuery',
        type: 'function',
        line: 52,
      });
    });

    it('export modifier on class captured correctly', () => {
      const sessionManager = result.exports.find(
        (e) => e.name === 'SessionManager',
      );
      expect(sessionManager).toMatchObject({
        name: 'SessionManager',
        type: 'class',
        line: 77,
      });
    });
  });

  // ---- functions ----

  describe('functions', () => {
    it('correct number of functions extracted', () => {
      expect(result.functions).toHaveLength(7);
    });

    it('captures all typeof functions correctly', () => {
      const fnDecl = result.functions.find((f) => f.name === 'fetchUser');
      expect(fnDecl).toMatchObject({
        name: 'fetchUser',
        parameters: [
          { name: 'id', type: 'string' },
          { name: 'retry', type: 'boolean' },
        ],
        returnType: 'Promise<UserModel>',
        jsDoc: 'Fetches a user by id.',
        startLine: 41,
        endLine: 43,
      });

      const fnInt = result.functions.find((f) => f.name === 'internalHelper');
      expect(fnInt).toMatchObject({
        name: 'internalHelper',
        parameters: [{ name: 'value', type: 'string' }],
        returnType: 'string',
        jsDoc: null,
        startLine: 45,
        endLine: 47,
      });

      const fnArrow = result.functions.find((f) => f.name === 'buildQuery');
      expect(fnArrow).toMatchObject({
        name: 'buildQuery',
        parameters: [{ name: 'params', type: 'Record<string, string>' }],
        returnType: 'string',
        jsDoc: 'Builds a query string.',
        startLine: 52,
        endLine: 56,
      });

      const fnArrowInt = result.functions.find(
        (f) => f.name === 'internalArrow',
      );
      expect(fnArrowInt).toMatchObject({
        name: 'internalArrow',
        parameters: [{ name: 'x', type: 'number' }],
        returnType: 'number',
        jsDoc: null,
        startLine: 58,
        endLine: 58,
      });
    });

    it('async function return type wraps in Promise', () => {
      const fn = result.functions.find((f) => f.name === 'syncData');
      expect(fn?.returnType).toBe('Promise<void>');
    });

    it('function with no return annotation resolves inferred return type', () => {
      const fn = result.functions.find((f) => f.name === 'inferredReturn');
      expect(fn?.returnType).toBe('number');
    });
  });

  // ---- classes ----

  describe('classes', () => {
    it('correct number of classes extracted', () => {
      expect(result.classes).toHaveLength(3);
    });

    it('capture classes with correct values', () => {
      const expCls = result.classes.find((c) => c.name === 'SessionManager');
      expect(expCls).toMatchObject({
        name: 'SessionManager',
        jsDoc: 'Manages user sessions.',
        startLine: 77,
        endLine: 99,
      });

      const inCls = result.classes.find((c) => c.name === 'InternalCache');
      expect(inCls).toMatchObject({
        name: 'InternalCache',
        jsDoc: null,
        startLine: 101,
        endLine: 107,
      });
    });

    it('captures constructor as method', () => {
      const cls = result.classes.find((c) => c.name === 'SessionManager');
      const ctor = cls?.methods.find((m) => m.name === 'constructor');
      expect(ctor).toMatchObject({
        name: 'constructor',
        returnType: 'void',
        parameters: [
          { name: 'userId', type: 'string' },
          { name: 'maxSessions', type: 'number' },
        ],
        startLine: 81,
        endLine: 87,
      });
    });

    it('captures explicit property declarations with correct value', () => {
      const cls = result.classes.find((c) => c.name === 'SessionManager');
      const sessions = cls?.properties.find((p) => p.name === 'sessions');
      const maxSessions = cls?.properties.find((p) => p.name === 'maxSessions');
      expect(sessions).toMatchObject({
        name: 'sessions',
        type: 'Map<string, UserModel>',
      });

      expect(maxSessions).toMatchObject({
        name: 'maxSessions',
        type: 'number',
      });
    });

    it('captures method with correct field values', () => {
      const cls = result.classes.find((c) => c.name === 'SessionManager');
      const startSession = cls?.methods.find((m) => m.name === 'startSession');
      expect(startSession).toMatchObject({
        name: 'startSession',
        parameters: [{ name: 'token', type: 'string' }],
        returnType: 'boolean',
        jsDoc: 'Starts a new session.',
        startLine: 92,
        endLine: 94,
      });
    });

    it('capture method without jsDoc with null value', () => {
      const cls = result.classes.find((c) => c.name === 'SessionManager');
      const endSession = cls?.methods.find((m) => m.name === 'endSession');
      expect(endSession).toMatchObject({
        name: 'endSession',
        parameters: [{ name: 'token', type: 'string' }],
        returnType: 'void',
        jsDoc: null,
      });
    });
  });
});
