import { getStructure as getDirStructure } from './structure/getStructure';
import { fsAdapter } from './adapters/nodeFs.adapter';
import { join } from 'path';
import { parseAst as parser } from './ast/parseAst';

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

  getStructure: typeof getDirStructure;

  /**
   * parse ast of a list of file paths, which are `relative` to the project root
   *
   * ```ts
   * parseAst(['/src/index.ts', '/src/javascript.js'])
   *
   * // specify the languages to ignore others
   * // only get the ast of `ts` files
   * parseAst(['/src/index.ts', 'src/javascript.js'], {languages: ['ts']} )
   *
   * ```
   */
  parseAst: typeof parser;
}

export const loadProject = ({
  projectRoot,
  defaultIgnore,
}: LoadProjectArgs): LoadProjectReturnObject => {
  const getStructure: typeof getDirStructure = async ({ path, ignore }) => {
    const mergedIgnore: string[] = [];

    if (defaultIgnore) {
      mergedIgnore.push(...defaultIgnore);
    }

    if (ignore) {
      mergedIgnore.push(...ignore);
    }

    const normalizedIgnore = mergedIgnore.map((entry) =>
      entry.startsWith('/') ? join(projectRoot, entry) : entry,
    );

    return getDirStructure(
      {
        path: join(projectRoot, path),
        ...(normalizedIgnore.length && { ignore: normalizedIgnore }),
      },
      fsAdapter,
    );
  };

  const parseAst: typeof parser = (files, options) => {
    const fullPaths = files ? files.map((file) => join(projectRoot, file)) : [];
    return parser(fullPaths, options);
  };

  return { getStructure, parseAst };
};
