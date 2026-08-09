import { Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = error instanceof HttpException ? error.getResponse() : undefined;
    const details = typeof exceptionResponse === "object" && exceptionResponse !== null ? exceptionResponse as { code?: string; message?: string | string[] } : undefined;
    const rawMessage = typeof exceptionResponse === "string" ? exceptionResponse : details?.message;
    response.status(status).json({ success: false, code: details?.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"), message: Array.isArray(rawMessage) ? rawMessage.join("；") : rawMessage ?? "请求处理失败", requestId: response.getHeader("x-request-id") ?? request.header("x-request-id") });
  }
}
