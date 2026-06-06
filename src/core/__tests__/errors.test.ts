import { describe, it, expect } from 'vitest';
import {
  CommandFailedError,
  CommandTimeout,
  ErrorCode,
  FileExistsError,
  FileNotFoundError,
  InvalidOperationError,
  NodeNotFoundError,
  NotDirectoryError,
  ParseFailedError,
  ParserNotFoundError,
  PathOutsideRootError,
  PermissionDeniedError,
  ProjexorError,
  UnsupportedLanguageError,
} from '../errors';

describe('ProjexorError', () => {
  it('should set message and code correctly', () => {
    const err = new ProjexorError(
      ErrorCode.FILE_NOT_FOUND,
      'test message error',
    );

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ProjexorError);
    expect(err.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(err.message).toBe('test message error');
    expect(err.name).toBe('ProjexorError');
  });
});

describe('ProjexorError subclasses', () => {
  type ErrorCase = {
    ErrorClass: new (...args: never[]) => ProjexorError;
    args: unknown[];
    expectedCode: ErrorCode;
    expectedMessagePart?: string;
  };

  const cases: ErrorCase[] = [
    {
      ErrorClass: FileNotFoundError,
      args: ['file.txt'],
      expectedCode: ErrorCode.FILE_NOT_FOUND,
      expectedMessagePart: 'file.txt',
    },
    {
      ErrorClass: NotDirectoryError,
      args: ['file.txt'],
      expectedCode: ErrorCode.NOT_A_DIRECTORY,
      expectedMessagePart: 'file.txt',
    },
    {
      ErrorClass: FileExistsError,
      args: ['file.txt'],
      expectedCode: ErrorCode.FILE_ALREADY_EXISTS,
      expectedMessagePart: 'file.txt',
    },
    {
      ErrorClass: NodeNotFoundError,
      args: ['Node'],
      expectedCode: ErrorCode.NODE_NOT_FOUND,
      expectedMessagePart: 'Node',
    },
    {
      ErrorClass: ParseFailedError,
      args: ['file.ts'],
      expectedCode: ErrorCode.PARSE_FAILED,
      expectedMessagePart: 'file.ts',
    },
    {
      ErrorClass: ParserNotFoundError,
      args: ['babel'],
      expectedCode: ErrorCode.PARSER_NOT_FOUND,
      expectedMessagePart: 'babel',
    },
    {
      ErrorClass: UnsupportedLanguageError,
      args: [],
      expectedCode: ErrorCode.UNSUPPORTED_LANGUAGE,
    },
    {
      ErrorClass: CommandFailedError,
      args: [],
      expectedCode: ErrorCode.COMMAND_FAILED,
    },
    {
      ErrorClass: CommandTimeout,
      args: [],
      expectedCode: ErrorCode.COMMAND_TIMEOUT,
    },
    {
      ErrorClass: PermissionDeniedError,
      args: ['file.txt'],
      expectedCode: ErrorCode.PERMISSION_DENIED,
      expectedMessagePart: 'file.txt',
    },
    {
      ErrorClass: InvalidOperationError,
      args: [],
      expectedCode: ErrorCode.INVALID_OPERATION,
    },
    {
      ErrorClass: PathOutsideRootError,
      args: [],
      expectedCode: ErrorCode.PATH_OUTSIDE_ROOT,
    },
  ];

  it.each(cases)(
    '$ErrorClass.name should set correct code and message',
    ({ ErrorClass, args, expectedCode, expectedMessagePart }) => {
      const err = new (ErrorClass as new (...args: unknown[]) => ProjexorError)(
        ...args,
      );

      expect(err).toBeInstanceOf(ProjexorError);
      expect(err.code).toBe(expectedCode);
      expect(err.message).toBeTruthy();

      if (expectedMessagePart) {
        expect(err.message).toContain(expectedMessagePart);
      }
    },
  );
});
