import type { HttpRequest, InvocationContext } from '@azure/functions';

export function createMockRequest(options: {
  url?: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
}): HttpRequest {
  const queryMap = new Map<string, string>();
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      queryMap.set(k, v);
    }
  }

  const queryParams = new URLSearchParams();
  for (const [k, v] of queryMap.entries()) {
    queryParams.set(k, v);
  }
  const queryString = queryParams.toString();
  const url = options.url || `http://localhost:7071/api/test${queryString ? `?${queryString}` : ''}`;

  return {
    url,
    method: options.method || 'GET',
    query: {
      get: (key: string) => queryMap.get(key) ?? null,
      has: (key: string) => queryMap.has(key),
      keys: () => queryMap.keys(),
      values: () => queryMap.values(),
      entries: () => queryMap.entries(),
      [Symbol.iterator]: () => queryMap.entries(),
    },
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
