import type { FailureResult, SuccessResult } from '../core/types';
import mapper from './languages/mapper';
import { createFailure, createSuccess } from '../utils/result';
import type { ParserOptions, ParserResult, SupportedLanguages } from './types';
import { ProjexorError } from '../core/errors';

export function parseAst<L extends SupportedLanguages = SupportedLanguages>(
  files: string[],
  options?: ParserOptions<L>,
): SuccessResult<ParserResult<L>> | FailureResult {
  const langs = options?.languages;
  files = files ?? []; // when files undefined

  // group file by language
  const groups: Partial<Record<SupportedLanguages, string[]>> = {};
  for (const file of files) {
    const ext = file.split('.').pop();
    if (!ext) continue;

    if (langs && !langs.includes(ext as L)) {
      continue; // exclude
    }

    const langExt = ext as L;
    if (!groups[langExt]) groups[langExt] = [];
    groups[langExt].push(file);
  }

  const result: Partial<ParserResult<L>> = {};
  const targetLangs = langs ?? (Object.keys(groups) as L[]);

  for (const lang of targetLangs) {
    const parser = mapper[lang];

    if (!parser) {
      result[lang] = { supported: false };
      continue;
    }

    const files = groups[lang] ?? []; // in case undefined;

    try {
      const parsed = options?.[lang]
        ? parser(files, options?.[lang])
        : parser(files);
      result[lang] = parsed;
    } catch (error) {
      if (error instanceof ProjexorError) {
        return createFailure(error.code, error.message);
      }

      throw error;
    }
  }

  return createSuccess(result as ParserResult<L>);
}
