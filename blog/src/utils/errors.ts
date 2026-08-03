/**
 * 应用错误类
 * 提供标准化的错误处理
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details
    };
  }
}

// 常见错误类型
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number = 60) {
    super('Too many requests, please try again later', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

// 断言辅助函数
export function assert(condition: any, error: AppError): asserts condition {
  if (!condition) {
    throw error;
  }
}

export function assertFound<T>(value: T | null | undefined, resource: string, id?: string | number): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, id);
  }
}

export function assertAuthorized(condition: boolean, message?: string): void {
  if (!condition) {
    throw new ForbiddenError(message);
  }
}