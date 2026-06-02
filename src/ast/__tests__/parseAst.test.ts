import { describe, it, expect, vi, afterEach } from 'vitest';
import mapper from '../languages/mapper';
import { parseAst } from '../parseAst';
import type { ASTResult, SuccessResult } from '../../core/types';
import type { ParserResult } from '../types';
import { ErrorCode, ParseFailedError } from '../../core/errors';

vi.mock(import('../languages/mapper'), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: {
      ts: vi.fn(),
      js: vi.fn(),
    },
  };
});

describe('parseAst', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('call the correct parser for a language', () => {
    parseAst(['a.ts', 'b.ts', 'c.js']);

    expect(vi.mocked(mapper.ts)).toHaveBeenCalledOnce();
    expect(vi.mocked(mapper.ts)).toHaveBeenCalledWith(['a.ts', 'b.ts']);

    expect(vi.mocked(mapper.js)).toHaveBeenCalledOnce();
    expect(vi.mocked(mapper.js)).toHaveBeenCalledWith(['c.js']);
  });

  it('pass the language specific options to the correct parser', () => {
    parseAst(['a.ts', 'b.js'], {
      ts: { allowJs: false },
      js: { allowJs: true },
    });

    expect(vi.mocked(mapper.ts)).toHaveBeenCalledWith(['a.ts'], {
      allowJs: false,
    });

    expect(vi.mocked(mapper.js)).toHaveBeenCalledWith(['b.js'], {
      allowJs: true,
    });
  });

  it('return correct success result structure', () => {
    vi.mocked(mapper.ts).mockImplementation((files) => {
      return files.reduce((acc: Record<string, ASTResult>, file) => {
        acc[file] = {
          filePath: file,
          lines: 0,
          imports: [],
          exports: [],
          classes: [],
          functions: [],
          supported: true,
        };

        return acc;
      }, {});
    });

    const result = parseAst(['a.ts']);
    expect(result.success).toBe(true);

    const sucResult = result as SuccessResult<ParserResult<'ts'>>;
    const tsFiles = sucResult.data.ts as Record<string, ASTResult>;
    expect(tsFiles['a.ts']).toMatchObject({
      filePath: 'a.ts',
      lines: 0,
      supported: true,
    });
  });

  it('return {supported: false} for unsupported language', () => {
    const result = parseAst(['a.py']);

    expect(result).toMatchObject({
      success: true,
      data: {
        py: {
          supported: false,
        },
      },
    });
  });

  it('exclude other languages if language list is given', () => {
    vi.mocked(mapper.ts).mockImplementation((files) => {
      return files.reduce((acc: Record<string, ASTResult>, file) => {
        acc[file] = {
          filePath: file,
          lines: 0,
          imports: [],
          exports: [],
          classes: [],
          functions: [],
          supported: true,
        };
        return acc;
      }, {});
    });

    const result = parseAst(['a.ts', 'b.js'], { languages: ['ts'] });

    expect(result).toMatchObject({
      success: true,
      data: {
        ts: { 'a.ts': { filePath: 'a.ts' } },
      },
    });

    expect(mapper.js).not.toHaveBeenCalled();
  });

  it('empty success when specified language does not match any file in the list', () => {
    vi.mocked(mapper.ts).mockReturnValue({} as Record<string, ASTResult>);

    const result = parseAst(['a.js'], { languages: ['ts'] });

    expect(result.success).toBe(true);
    expect(mapper.ts).toHaveBeenCalledWith([]);
  });

  it('return empty success when no files', () => {
    const result = parseAst([]);

    expect(result.success).toBe(true);
    expect((result as SuccessResult<ParserResult>).data).toEqual({});
  });

  it('return empty success when undefined passed', () => {
    const result = parseAst(undefined as unknown as string[]);

    expect(result.success).toBe(true);
    expect((result as SuccessResult<ParserResult>).data).toEqual({});
  });

  it('creates failure result if parser throws ProjexorError', () => {
    vi.mocked(mapper.ts).mockImplementation(() => {
      throw new ParseFailedError('a.ts');
    });

    const result = parseAst(['a.ts']);

    expect(result).toMatchObject({
      success: false,
      error: {
        code: ErrorCode.PARSE_FAILED,
      },
    });
  });

  it('throw error for unknown errors', () => {
    vi.mocked(mapper.ts).mockImplementation(() => {
      throw new Error();
    });

    expect(() => parseAst(['a.ts'])).toThrow();
  });
});
