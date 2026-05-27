import type { FailureResult, SuccessResult } from '../core/types';

export const createSuccess = <T>(data: T): SuccessResult<T> => {
  return { success: true, data };
};

export const createFailure = (code: string, message: string): FailureResult => {
  return { success: false, error: { code, message } };
};
