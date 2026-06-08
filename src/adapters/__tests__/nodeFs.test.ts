import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import { fsAdapter } from '../nodeFs.adapter';
import { ErrorCode, ProjexorError } from '../../core/errors';

// create temp file dir
const tempDir = fs.mkdtempDisposableSync('_fs_adapter_');

// create children
fs.mkdirSync(path.join(tempDir.path, 'src'), { recursive: true });
fs.mkdirSync(path.join(tempDir.path, 'src/core'));
fs.writeFileSync(path.join(tempDir.path, 'src/index.ts'), '');
fs.writeFileSync(path.join(tempDir.path, 'config.ts'), '');

afterAll(() => {
  tempDir.remove();
});

describe('fsAdapter', () => {
  describe('fsAdapter.readdir', () => {
    it('return correct name, path, type of each children', async () => {
      const dirChildren = await fsAdapter.readDir(tempDir.path);

      expect(dirChildren.length).toBe(2);

      const childrenMap = dirChildren.reduce(
        (acc, { name, path, type }) => {
          acc[name] = { path, type };
          return acc;
        },
        {} as Record<string, unknown>,
      );

      expect(childrenMap['src']).toEqual({
        path: `${tempDir.path}/src`,
        type: 'directory',
      });

      expect(childrenMap['config.ts']).toEqual({
        path: `${tempDir.path}/config.ts`,
        type: 'file',
      });
    });

    it('return correct name, path, type of subdirectory children', async () => {
      const dirChildren = await fsAdapter.readDir(
        path.join(tempDir.path, '/src'),
      );

      expect(dirChildren.length).toBe(2);

      const childrenMap = dirChildren.reduce(
        (acc, { name, path, type }) => {
          acc[name] = { path, type };
          return acc;
        },
        {} as Record<string, unknown>,
      );

      expect(childrenMap['core']).toEqual({
        path: `${tempDir.path}/src/core`,
        type: 'directory',
      });

      expect(childrenMap['index.ts']).toEqual({
        path: `${tempDir.path}/src/index.ts`,
        type: 'file',
      });
    });

    it('throw DIRECTORY_NOT_FOUND if directory not exists', async () => {
      await fsAdapter
        .readDir(path.join(tempDir.path, 'not-exist-in-temp'))
        .then(() => expect.fail('Should have thrown'))
        .catch((error) => {
          expect(error.constructor).toBe(ProjexorError);
          expect(error.code).toBe(ErrorCode.DIRECTORY_NOT_FOUND);
        });
    });

    it('throw NOT_A_DIRECTORY if path not directory', async () => {
      await fsAdapter
        .readDir(path.join(tempDir.path, 'src/index.ts'))
        .then(() => expect.fail('Should have thrown'))
        .catch((error) => {
          expect(error.constructor).toBe(ProjexorError);
          expect(error.code).toBe(ErrorCode.NOT_A_DIRECTORY);
        });
    });

    it('throw PERMISSION_DENIED if directory is protected', async () => {
      // create restricted subdirectory
      fs.mkdirSync(path.join(tempDir.path, 'protected'));
      fs.chmodSync(path.join(tempDir.path, 'protected'), 0o000);

      await fsAdapter
        .readDir(path.join(tempDir.path, 'protected'))
        .then(() => expect.fail('Should have thrown'))
        .catch((error) => {
          expect(error.constructor).toBe(ProjexorError);
          expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
        });

      // remove protection
      fs.chmodSync(path.join(tempDir.path, 'protected'), 0o777);
    });
  });
});
