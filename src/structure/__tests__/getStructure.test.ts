import { beforeAll, describe, expect, it } from 'vitest';
import { createStructureReader } from '../getStructure';
import type { FsAdapter, FsReadDirReturn } from '../../adapters/adapters';
import type {
  FailureResult,
  ProjectStructure,
  SuccessResult,
} from '../../core/types';
import {
  ErrorCode,
  FileNotFoundError,
  NotDirectoryError,
  PermissionDeniedError,
} from '../../core/errors';

// fsAdapter.readDir(path), called multiple types.
const makeMockFsAdapter = (
  dirMap: Record<string, FsReadDirReturn[] | (() => never)>,
): FsAdapter => ({
  readDir: async (path: string) => {
    const entry = dirMap[path];
    if (entry === undefined) throw new FileNotFoundError(path);
    if (typeof entry === 'function') entry();

    return entry as FsReadDirReturn[];
  },
});

describe('getStructure', () => {
  describe('happy path - deep nested structure', () => {
    let data: ProjectStructure;

    beforeAll(async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': [
          { name: 'src', path: '/project/src', type: 'directory' },
          { name: 'config.ts', path: '/project/config.ts', type: 'file' },
        ],

        '/project/src': [
          { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
          { name: 'core', path: '/project/src/core', type: 'directory' },
        ],

        '/project/src/core': [
          {
            name: 'types.ts',
            path: '/project/src/core/types.ts',
            type: 'file',
          },
        ],
      });

      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project');
      expect(result.success).toBe(true);
      data = (result as SuccessResult<ProjectStructure>).data;
    });

    it('sets basePath correctly', () => {
      expect(data.basePath).toBe('/project');
    });

    it('returns correct number of top-level children', () => {
      expect(data.tree).toHaveLength(2);
    });

    it('file node has correct shape', () => {
      const config = data.tree.find((n) => n.name === 'config.ts');

      expect(config).toMatchObject({
        name: 'config.ts',
        path: '/project/config.ts',
        type: 'file',
        children: [],
      });
    });

    it('directory node has correct shape', () => {
      const src = data.tree.find((n) => n.name === 'src');

      expect(src).toMatchObject({
        name: 'src',
        path: '/project/src',
        type: 'directory',
      });
    });

    it('resolve nested children correctly', () => {
      const src = data.tree.find((n) => n.name === 'src');
      expect(src?.children).toHaveLength(2);
    });

    it('resolve deep nested correctly', () => {
      const src = data.tree.find((n) => n.name === 'src');
      const core = src?.children.find((n) => n.name === 'core');

      expect(core?.children).toHaveLength(1);
      expect(core?.children[0]).toMatchObject({
        name: 'types.ts',
        path: '/project/src/core/types.ts',
        type: 'file',
        children: [],
      });
    });
  });

  describe('relative target path', () => {
    let fsAdapter: FsAdapter;

    beforeAll(async () => {
      fsAdapter = makeMockFsAdapter({
        '/project': [
          { name: 'src', path: '/project/src', type: 'directory' },
          { name: 'config.ts', path: '/project/config.ts', type: 'file' },
        ],

        '/project/src': [
          { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
          { name: 'core', path: '/project/src/core', type: 'directory' },
        ],

        '/project/src/core': [
          {
            name: 'types.ts',
            path: '/project/src/core/types.ts',
            type: 'file',
          },
        ],
      });
    });

    it('returns tree of relative target path', async () => {
      const { getStructure } = createStructureReader(fsAdapter, '/project');
      const result = await getStructure('src');

      expect(result.success).toBe(true);
      const data = (result as SuccessResult<ProjectStructure>).data;

      expect(data).toMatchObject({
        basePath: '/project',
        targetPath: 'src',
      });

      expect(data.tree.length).toBe(2);
    });

    it('nested children path start with normalized targetPath', async () => {
      const { getStructure } = createStructureReader(fsAdapter, '/project');
      const result = await getStructure('./src');
      expect(result.success).toBe(true);
      const data = (result as SuccessResult<ProjectStructure>).data;

      data.tree.forEach((child) => {
        expect(child.path.startsWith('src')).toBe(true);
        child.children.forEach(({ path }) => {
          expect(path.startsWith('src')).toBe(true);
        });
      });
    });
  });

  describe('ignore', () => {
    let fsAdapter: FsAdapter;

    beforeAll(async () => {
      fsAdapter = makeMockFsAdapter({
        '/project': [
          { name: 'src', path: '/project/src', type: 'directory' },
          { name: 'dist', path: '/project/dist', type: 'directory' },
          { name: 'config.ts', path: '/project/config.ts', type: 'file' },
        ],
        '/project/src': [
          { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
        ],
      });
    });

    it('ignores names in the list', async () => {
      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project', {
        ignore: ['dist', 'src'],
      });

      expect(result.success).toBe(true);
      const data = (result as SuccessResult<ProjectStructure>).data;

      expect(data.tree).toHaveLength(1);
      expect(data.tree[0]).toMatchObject({
        name: 'config.ts',
        path: '/project/config.ts',
        type: 'file',
        children: [],
      });
    });

    it('ignores paths in the list', async () => {
      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project', {
        ignore: ['/project/dist', '/project/src'],
      });

      expect(result.success).toBe(true);
      const data = (result as SuccessResult<ProjectStructure>).data;

      expect(data.tree).toHaveLength(1);
      expect(data.tree[0]).toMatchObject({
        name: 'config.ts',
        path: '/project/config.ts',
        type: 'file',
        children: [],
      });
    });
  });

  describe('edge cases', () => {
    it('include permission denied sub directory with empty children', async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': [
          { name: 'src', path: '/project/src', type: 'directory' },
          { name: 'secret', path: '/project/secret', type: 'directory' },
        ],
        '/project/src': [
          { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
        ],

        '/project/secret': () => {
          throw new PermissionDeniedError('/project/secret');
        },
      });

      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project');

      expect(result.success).toBe(true);
      const data = (result as SuccessResult<ProjectStructure>).data;

      const secret = data.tree.find((n) => n.name === 'secret');
      expect(secret?.children).toEqual([]);

      const src = data.tree.find((n) => n.name === 'src');
      expect(src?.children).toHaveLength(1);
    });
  });

  describe('failure cases', () => {
    it('return FailureResult if path does not exist', async () => {
      const fsAdapter = makeMockFsAdapter({});
      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project');

      expect(result.success).toBe(false);
      expect((result as FailureResult).error.code).toBe(
        ErrorCode.FILE_NOT_FOUND,
      );
    });

    it('return FailureResult if path is not directory', async () => {
      const adapter = makeMockFsAdapter({
        '/project': () => {
          throw new NotDirectoryError('/project');
        },
      });

      const { getStructure } = createStructureReader(adapter);
      const result = await getStructure('/project');

      expect(result.success).toBe(false);
      expect((result as FailureResult).error.code).toBe(
        ErrorCode.NOT_A_DIRECTORY,
      );
    });

    it('return FailureResult if directory is protected', async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': () => {
          throw new PermissionDeniedError('/project');
        },
      });

      const { getStructure } = createStructureReader(fsAdapter);
      const result = await getStructure('/project');

      expect(result.success).toBe(false);
      expect((result as FailureResult).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      );
    });

    it('throw unknown internal error', async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': () => {
          throw new Error();
        },
      });

      const { getStructure } = createStructureReader(fsAdapter);

      await expect(getStructure('/project')).rejects.toThrow();
    });
  });
});
