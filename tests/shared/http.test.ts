import { describe, expect, it, vi } from 'vitest';
import { internalServerError } from '../../src/shared/http';
import { createMockContext } from '../mocks/mockHelpers';

describe('internalServerError', () => {
  it('returns a generic error message without leaking sensitive internal details', () => {
    const sensitiveError = new Error('Cosmos DB connection failure: mongodb://user:pass@secret.host:10255');
    const mockContext = createMockContext();
    const errorSpy = vi.spyOn(mockContext, 'error');

    const res = internalServerError(sensitiveError, mockContext);

    expect(res.status).toBe(500);
    expect(res.jsonBody).toEqual({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the request.',
    });
    // Context logger receives the real error for diagnostics
    expect(errorSpy).toHaveBeenCalledWith('Internal server error:', sensitiveError);
  });

  it('logs to console.error when InvocationContext is not supplied', () => {
    const sensitiveError = new Error('Disk read failure');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = internalServerError(sensitiveError);

    expect(res.status).toBe(500);
    expect(res.jsonBody).toEqual({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the request.',
    });
    expect(consoleSpy).toHaveBeenCalledWith('Internal server error:', sensitiveError);

    consoleSpy.mockRestore();
  });
});
