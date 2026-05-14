import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { redactSensitiveData } from '../security/redaction.js';

interface JsonResponse {
  status(status: number): { json(body: unknown): void };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<JsonResponse>();
    const request = ctx.getRequest<{ requestId?: string }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as any).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';
    const isUnexpected = !(exception instanceof HttpException);
    if (isUnexpected) {
      console.error(
        JSON.stringify(
          redactSensitiveData({
            level: 'error',
            event: 'unhandled_exception',
            requestId: request.requestId,
            status,
            message: rawMessage
          })
        )
      );
    }
    response.status(status).json({
      code: status,
      message:
        isUnexpected && process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : redactSensitiveData(rawMessage),
      details: typeof payload === 'object' ? redactSensitiveData(payload) : undefined,
      requestId: request.requestId
    });
  }
}
