import { describe, it, expect } from 'vitest';
import { createFailure, createSuccess } from '../result';

describe('result utilities', () => {
  it('createSuccess should return success response', () => {
    const result = createSuccess({ id: 1 });

    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it('createFailure should return failure response', () => {
    const result = createFailure('TEST_CODE', 'test error');

    expect(result).toEqual({
      success: false,
      error: { code: 'TEST_CODE', message: 'test error' },
    });
  });
});
