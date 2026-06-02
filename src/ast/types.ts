import type { ASTResult } from '../core/types';
import type ts from 'typescript';

export type SupportedLanguages = 'ts' | 'js';

export interface LanguageAstMap {
  ts: ASTResult;
  js: ASTResult;
}

export interface LanguageOptions {
  ts?: ts.CompilerOptions;
  js?: ts.CompilerOptions;
}

export type ParserOptions<L extends SupportedLanguages> = LanguageOptions & {
  languages?: readonly L[];
};

export type ParserResult<L extends SupportedLanguages = SupportedLanguages> = {
  [K in L]: Record<string, LanguageAstMap[K]> | { supported: false };
};
