import fs from 'fs/promises';
import type { FsAdapter, FsReadDirReturn } from './adapters';
import { ErrorCode, ProjexorError } from '../core/errors';

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
          throw new ProjexorError(
            ErrorCode.DIRECTORY_NOT_FOUND,
            `directory not found: ${path}`,
          );

        case 'ENOTDIR':
          throw new ProjexorError(
            ErrorCode.NOT_A_DIRECTORY,
            `not a directory: ${path}`,
          );

        case 'EACCES':
        case 'EPERM':
          throw new ProjexorError(
            ErrorCode.PERMISSION_DENIED,
            `permission denied: ${path}`,
          );

        default:
          throw error;
      }
    }
  },
};
