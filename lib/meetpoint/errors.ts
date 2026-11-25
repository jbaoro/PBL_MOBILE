/** 서버 오류 형식. 화면에 보여줄 한국어 문구와 HTTP 상태, 다시 시도 가능 여부를 함께 담는다. */
import type { ApiErrorCode, PublicError } from './types';

/** 의도한 오류. 코드·문구가 그대로 클라이언트에 전달된다. */
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

/** 클라이언트에 보낼 오류. 예상하지 못한 오류는 내부 내용(키·URL·원본 응답)을 숨기고 일반 문구로 바꾼다. */
export function publicError(error: unknown): PublicError {
  if (error instanceof MeetPointError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  // 외부 API 원본 응답, 요청 URL, 키 같은 정보는 절대 클라이언트에 보내지 않는다.
  return { code: 'UPSTREAM_ERROR', message: '조회 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', retryable: true };
}
