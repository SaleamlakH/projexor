import type { FsAdapter, FsReadDirReturn } from '../adapters/adapters';
import type {
  FailureResult,
  FileNode,
  ProjectStructure,
  SuccessResult,
} from '../core/types';
import { createFailure, createSuccess } from '../utils/result';
import { PermissionDeniedError, ProjexorError } from '../core/errors';
import path, { join } from 'path';

export type GetStructureOptions = {
  ignore?: string[];
};

export type GetStructure = (
  path: string,
  options?: GetStructureOptions,
) => Promise<SuccessResult<ProjectStructure> | FailureResult>;

/**
 * Walks the directory at `path` and returns a JSON file tree.
 * Any path matching the `ignore` parameter and the global `defaultIgnore` list are excluded.
 */
export const createStructureReader = (
  fsAdapter: FsAdapter,
  basePath?: string,
): { getStructure: GetStructure } => {
  const removeBasePath = (basePath: string, fullPath: string) => {
    const relative = path.relative(basePath, fullPath);
    return path.normalize(relative);
  };

  const getStructure: GetStructure = async (path: string, options) => {
    const fullPath = basePath ? join(basePath, path) : path;
    const ignore = options?.ignore;

    const walkDir = async (currentPath: string): Promise<FileNode[]> => {
      const dirChildren: FsReadDirReturn[] = [];

      try {
        const readResult = await fsAdapter.readDir(currentPath);
        dirChildren.push(...readResult);
      } catch (error) {
        if (error instanceof PermissionDeniedError) {
          if (path === currentPath) throw error;
          return [];
        }

        throw error;
      }

      const tree: FileNode[] = [];
      for (const child of dirChildren) {
        // ignore
        if (ignore?.includes(child.name) || ignore?.includes(child.path))
          continue;

        // remove base path
        const childPath = basePath
          ? removeBasePath(basePath, child.path)
          : child.path;

        if (child.type === 'file') {
          tree.push({ ...child, path: childPath, children: [] });
          continue;
        }

        // walk directory
        const nestedTree = await walkDir(child.path);

        tree.push({
          ...child,
          path: childPath,
          children: nestedTree,
        });
      }

      return tree;
    };

    try {
      const dirTree = await walkDir(fullPath);
      return createSuccess({
        basePath: basePath || path,
        targetPath: path,
        tree: dirTree,
      });
    } catch (error) {
      if (error instanceof ProjexorError) {
        return createFailure(error.code, error.message);
      }

      throw error;
    }
  };

  return { getStructure };
};
