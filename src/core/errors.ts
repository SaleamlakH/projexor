export class ProjexorError extends Error {
  code;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class FileNotFoundError extends ProjexorError {
  constructor(filePath: string) {
    super('FILE_NOT_FOUND', `couldn't find a file with path ${filePath}`);
  }
}

export class FileExistsError extends ProjexorError {
  constructor(filePath: string) {
    super(
      'FILE_ALREADY_EXISTS',
      `couldn't create ${filePath}, it already exist`,
    );
  }
}

export class NodeNotFoundError extends ProjexorError {
  constructor(nodeName: string) {
    super('NODE_NOT_FOUND', `couldn't find AST node ${nodeName}`);
  }
}

export class ParseFailedError extends ProjexorError {
  constructor(filePath: string) {
    super('PARSE_FAILED', `couldn't parse AST of ${filePath}`);
  }
}

export class ParserNotFoundError extends ProjexorError {
  constructor(parserName: string) {
    super(
      'PARSER_NOT_FOUND',
      `couldn't find ${parserName} for AST parser. required to install appropriate dependency`,
    );
  }
}

export class UnsupportedLanguageError extends ProjexorError {
  constructor() {
    super('UNSUPPORTED_LANGUAGE', 'extension has no registered parser');
  }
}

export class CommandFailedError extends ProjexorError {
  constructor() {
    super(
      'COMMAND_FAILED',
      'could not execute command, process exited with non zero code',
    );
  }
}

export class CommandTimeout extends ProjexorError {
  constructor() {
    super('COMMAND_TIMEOUT', 'command process exceed timeout');
  }
}

export class PermissionDeniedError extends ProjexorError {
  constructor(filePath: string) {
    super(
      'PERMISSION_DENIED',
      `could not perform operation on ${filePath}, permission denied`,
    );
  }
}

export class InvalidOperationError extends ProjexorError {
  constructor() {
    super(
      'INVALID_OPERATION',
      'Invalid line range or malformed operation parameters',
    );
  }
}

export class PathOutsideRootError extends ProjexorError {
  constructor() {
    super('PATH_OUTSIDE_ROOT', 'Path attempts to escape the root');
  }
}
