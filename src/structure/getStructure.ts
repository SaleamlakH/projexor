import type { FsAdapter } from '../adapters/adapters';
import type { FileNode, ProjectStructure } from '../core/types';
import path, { join } from 'path';

export type GetStructureOptions = {
  ignore?: string[];
};

export type GetStructure = (
  path: string,
  options?: GetStructureOptions,
) => Promise<ProjectStructure>;

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
      const dirChildren = await fsAdapter.readDir(currentPath);

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

        // walk director,
        // catch any error and set the children empty
        let nestedTree: FileNode[] = [];
        try {
          nestedTree = await walkDir(child.path);
        } catch {
          nestedTree = [];
        }

        tree.push({ ...child, path: childPath, children: nestedTree });
      }

      return tree;
    };

    const dirTree = await walkDir(fullPath);
    return {
      basePath: basePath || path,
      targetPath: path,
      tree: dirTree,
    };
  };

  return { getStructure };
};
