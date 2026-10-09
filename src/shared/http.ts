import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export function ok<T>(data: T, status = 200): HttpResponseInit {
  return { status, jsonBody: data };
}

export function created<T>(data: T): HttpResponseInit {
  return { status: 201, jsonBody: data };
}

export function noContent(): HttpResponseInit {
  return { status: 204 };
}

export function badRequest(message: string, details?: unknown): HttpResponseInit {
  return {
    status: 400,
    jsonBody: { error: message, ...(details !== undefined ? { details } : {}) },
  };
}

export function notFound(message = 'Resource not found'): HttpResponseInit {
  return {
    status: 404,
    jsonBody: { error: message },
  };
}

export function internalServerError(error: unknown, context?: InvocationContext): HttpResponseInit {
  const message = error instanceof Error ? error.message : 'Unknown internal error';
  if (context) {
    context.error('Internal server error:', error);
  } else {
    console.error('Internal server error:', error);
  }
  return {
    status: 500,
    jsonBody: { error: 'Internal server error', message },
  };
}

export function requireQueryParam(request: HttpRequest, name: string): string {
  const value = request.query.get(name)?.trim();
  if (!value) {
    throw new QueryParamError(`Query parameter '${name}' is required.`);
  }
  return value;
}

export class QueryParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryParamError';
  }
}
