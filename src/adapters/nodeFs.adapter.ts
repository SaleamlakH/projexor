import fs from 'fs/promises';
import type { FsAdapter, FsReadDirReturn } from './adapters';
import {
  FileNotFoundError,
  NotDirectoryError,
  PermissionDeniedError,
} from '../core/errors';

export const fsAdapter: FsAdapter = {
  readDir: async (path: string): Promise<FsReadDirReturn[]> => {
    try {
      const result = await fs.readdir(path, { withFileTypes: true });
      return result.map((item) => {
        return {
          name: item.name,
          path: `${path}/${item.name}`,
          type: item.isFile() ? 'file' : 'directory',
        };
      });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      switch (nodeError.code) {
        case 'ENOENT':
          throw new FileNotFoundError(path);

        case 'ENOTDIR':
          throw new NotDirectoryError(path);

        case 'EACCES':
        case 'EPERM':
          throw new PermissionDeniedError(path);

        default:
          throw error;
      }
    }
  },
};
