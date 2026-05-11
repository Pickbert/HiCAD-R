import { randomUUID } from 'node:crypto';

interface RequestLike {
  requestId?: string;
  startedAt?: number;
  method: string;
  path: string;
  header(name: string): string | undefined;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

export function requestContextMiddleware(request: RequestLike, response: ResponseLike, next: () => void) {
  request.requestId = request.header('x-request-id') ?? randomUUID();
  request.startedAt = Date.now();
  response.setHeader('x-request-id', request.requestId);
  response.on('finish', () => {
    const elapsedMs = Date.now() - (request.startedAt ?? Date.now());
    if (elapsedMs > Number(process.env.SLOW_REQUEST_MS ?? 1000)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'slow_request',
          requestId: request.requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          elapsedMs
        })
      );
    }
  });
  next();
}
