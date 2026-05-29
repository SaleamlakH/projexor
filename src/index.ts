import type {
  FailureResult,
  ProjectStructure,
  SuccessResult,
} from './core/types';
import {
  getStructure as getDirStructure,
  type GetStructureArgs,
} from './structure/getStructure';
import { fsAdapter } from './adapters/nodeFs.adapter';
import { join } from 'path';

type LoadProjectArgs = {
  projectRoot: string;
  defaultIgnore?: string[];
};

interface LoadProjectReturnObject {
  /**
   * Walks the directory at `path` and returns a JSON file tree.
   *
   * Any path matching the `ignore` parameter and the global `defaultIgnore` list are excluded.
   *
   * The path or the names of directory in the ignore list need to match the exact name and path.
   * Path need to start with `/`, e.g `/dist`
   *
   * ```ts
   * // get the structure of the whole project
   * getStructure({path: '.'});
   *
   * // ignore directory and files
   * getStructure({path: '.', ignore: ['/src', 'src', '/src/tests']})
   * ```
   */

  getStructure({
    path,
    ignore,
  }: GetStructureArgs): Promise<
    SuccessResult<ProjectStructure> | FailureResult
  >;
}

export const loadProject = ({
  projectRoot,
  defaultIgnore,
}: LoadProjectArgs): LoadProjectReturnObject => {
  const getStructure = async ({
    path,
    ignore,
  }: GetStructureArgs): Promise<
    SuccessResult<ProjectStructure> | FailureResult
  > => {
    const mergedIgnore = [];

    if (defaultIgnore) {
      mergedIgnore.push(...defaultIgnore);
    }

    if (ignore) {
      mergedIgnore.push(...ignore);
    }

    return getDirStructure(
      {
        path: join(projectRoot, path),
        ...(mergedIgnore.length && { ignore: mergedIgnore }),
      },
      fsAdapter,
    );
  };

  return { getStructure };
};
