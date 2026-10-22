import type { ApiErrorCode, PublicError } from './types';

export class MeetPointError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, message: string, httpStatus = 400, retryable = false) {
    super(message);
    this.name = 'MeetPointError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

export function publicError(error: unknown): PublicError {
  if (error instanceof MeetPointError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  // Never expose raw upstream responses, request URLs or credentials to clients.
  return { code: 'UPSTREAM_ERROR', message: '조회 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', retryable: true };
}
