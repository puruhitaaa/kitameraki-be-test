import type { HttpRequest, InvocationContext } from '@azure/functions';

export function createMockRequest(options: {
  url?: string;
  method?: string;
  query?: Record<string, string>;
  queryString?: string;
  body?: unknown;
}): HttpRequest {
  const query = new URLSearchParams(options.queryString ?? '');
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      query.set(k, v);
    }
  }

  const serialized = query.toString();
  const url = options.url || `http://localhost:7071/api/test${serialized ? `?${serialized}` : ''}`;

  return {
    url,
    method: options.method || 'GET',
    query,
    json: async () => {
      if (options.body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input');
      }
      return options.body;
    },
    headers: new Headers(),
  } as unknown as HttpRequest;
}

export function createMockContext(): InvocationContext {
  return {
    log: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    invocationId: 'test-inv-id',
    functionName: 'test-function',
  } as unknown as InvocationContext;
}
