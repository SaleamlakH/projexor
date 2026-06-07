import { beforeAll, describe, expect, it } from 'vitest';
import { createStructureReader } from '../getStructure';
import type { FsAdapter, FsReadDirReturn } from '../../adapters/adapters';
import type { ProjectStructure } from '../../core/types';
import { ErrorCode, ProjexorError } from '../../core/errors';

// fsAdapter.readDir(path), called multiple types.
const makeMockFsAdapter = (
  dirMap: Record<string, FsReadDirReturn[] | (() => never)>,
): FsAdapter => ({
  readDir: async (path: string) => {
    const entry = dirMap[path];
    if (entry === undefined)
      throw new ProjexorError(
        ErrorCode.DIRECTORY_NOT_FOUND,
        'directory not found',
      );
    if (typeof entry === 'function') entry();

    return entry as FsReadDirReturn[];
  },
});

describe('getStructure', () => {
  describe('happy path - deep nested structure', () => {
    let structure: ProjectStructure;

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
      structure = await getStructure('/project');
    });

    it('sets basePath correctly', () => {
      expect(structure.basePath).toBe('/project');
    });

    it('returns correct number of top-level children', () => {
      expect(structure.tree).toHaveLength(2);
    });

    it('file node has correct shape', () => {
      const config = structure.tree.find((n) => n.name === 'config.ts');

      expect(config).toMatchObject({
        name: 'config.ts',
        path: '/project/config.ts',
        type: 'file',
        children: [],
      });
    });

    it('directory node has correct shape', () => {
      const src = structure.tree.find((n) => n.name === 'src');

      expect(src).toMatchObject({
        name: 'src',
        path: '/project/src',
        type: 'directory',
      });
    });

    it('resolve nested children correctly', () => {
      const src = structure.tree.find((n) => n.name === 'src');
      expect(src?.children).toHaveLength(2);
    });

    it('resolve deep nested correctly', () => {
      const src = structure.tree.find((n) => n.name === 'src');
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
      const structure = await getStructure('src');

      expect(structure).toMatchObject({
        basePath: '/project',
        targetPath: 'src',
      });

      expect(structure.tree.length).toBe(2);
    });

    it('nested children path start with normalized targetPath', async () => {
      const { getStructure } = createStructureReader(fsAdapter, '/project');
      const structure = await getStructure('./src');

      structure.tree.forEach((child) => {
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
      const structure = await getStructure('/project', {
        ignore: ['dist', 'src'],
      });

      expect(structure.tree).toHaveLength(1);
      expect(structure.tree[0]).toMatchObject({
        name: 'config.ts',
        path: '/project/config.ts',
        type: 'file',
        children: [],
      });
    });

    it('ignores paths in the list', async () => {
      const { getStructure } = createStructureReader(fsAdapter);
      const structure = await getStructure('/project', {
        ignore: ['/project/dist', '/project/src'],
      });

      expect(structure.tree).toHaveLength(1);
      expect(structure.tree[0]).toMatchObject({
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
          throw new ProjexorError(
            ErrorCode.PERMISSION_DENIED,
            'permission denied',
          );
        },
      });

      const { getStructure } = createStructureReader(fsAdapter);
      const structure = await getStructure('/project');

      const secret = structure.tree.find((n) => n.name === 'secret');
      expect(secret?.children).toEqual([]);

      const src = structure.tree.find((n) => n.name === 'src');
      expect(src?.children).toHaveLength(1);
    });
  });

  describe('failure cases', () => {
    it('bubble errors thrown by the root directory', async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': () => {
          throw new Error(
            'Any file system error (Not Found, Not a Directory, etc)',
          );
        },
      });
      const { getStructure } = createStructureReader(fsAdapter);
      await expect(getStructure('/project')).rejects.toThrow();
    });

    it('throw PERMISSION_DENIED if the target directory is protected', async () => {
      const fsAdapter = makeMockFsAdapter({
        '/project': () => {
          throw new ProjexorError(
            ErrorCode.PERMISSION_DENIED,
            'permission denied',
          );
        },
      });

      const { getStructure } = createStructureReader(fsAdapter);

      await expect(getStructure('/project')).rejects.toHaveProperty(
        'code',
        ErrorCode.PERMISSION_DENIED,
      );
    });
  });
});
