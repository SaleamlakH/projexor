export interface FsAdapter {
  readDir(path: string): Promise<FsReadDirReturn[]>;
}

export interface FsReadDirReturn {
  name: string;
  path: string;
  type: 'file' | 'directory';
}
