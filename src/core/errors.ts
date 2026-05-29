export const ErrorCode = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  FILE_ALREADY_EXISTS: 'FILE_ALREADY_EXISTS',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  PARSE_FAILED: 'PARSE_FAILED',
  PARSER_NOT_FOUND: 'PARSER_NOT_FOUND',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  COMMAND_FAILED: 'COMMAND_FAILED',
  COMMAND_TIMEOUT: 'COMMAND_TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_OPERATION: 'INVALID_OPERATION',
  PATH_OUTSIDE_ROOT: 'PATH_OUTSIDE_ROOT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ProjexorError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class FileNotFoundError extends ProjexorError {
  constructor(filePath: string) {
    super(ErrorCode.FILE_NOT_FOUND, `Path not found, ${filePath}`);
  }
}

export class NotDirectoryError extends ProjexorError {
  constructor(path: string) {
    super(ErrorCode.NOT_A_DIRECTORY, `Not a directory, ${path}`);
  }
}

export class FileExistsError extends ProjexorError {
  constructor(filePath: string) {
    super(
      ErrorCode.FILE_ALREADY_EXISTS,
      `couldn't create ${filePath}, it already exist`,
    );
  }
}

export class NodeNotFoundError extends ProjexorError {
  constructor(nodeName: string) {
    super(ErrorCode.NODE_NOT_FOUND, `couldn't find AST node ${nodeName}`);
  }
}

export class ParseFailedError extends ProjexorError {
  constructor(filePath: string) {
    super(ErrorCode.PARSE_FAILED, `couldn't parse AST of ${filePath}`);
  }
}

export class ParserNotFoundError extends ProjexorError {
  constructor(parserName: string) {
    super(
      ErrorCode.PARSER_NOT_FOUND,
      `couldn't find ${parserName} for AST parser. required to install appropriate dependency`,
    );
  }
}

export class UnsupportedLanguageError extends ProjexorError {
  constructor() {
    super(ErrorCode.UNSUPPORTED_LANGUAGE, 'extension has no registered parser');
  }
}

export class CommandFailedError extends ProjexorError {
  constructor() {
    super(
      ErrorCode.COMMAND_FAILED,
      'could not execute command, process exited with non zero code',
    );
  }
}

export class CommandTimeout extends ProjexorError {
  constructor() {
    super(ErrorCode.COMMAND_TIMEOUT, 'command process exceed timeout');
  }
}

export class PermissionDeniedError extends ProjexorError {
  constructor(filePath: string) {
    super(
      ErrorCode.PERMISSION_DENIED,
      `could not perform operation on ${filePath}, permission denied`,
    );
  }
}

export class InvalidOperationError extends ProjexorError {
  constructor() {
    super(
      ErrorCode.INVALID_OPERATION,
      'Invalid line range or malformed operation parameters',
    );
  }
}

export class PathOutsideRootError extends ProjexorError {
  constructor() {
    super(ErrorCode.PATH_OUTSIDE_ROOT, 'Path attempts to escape the root');
  }
}
