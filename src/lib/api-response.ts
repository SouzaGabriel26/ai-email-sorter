import { ApiResponse } from "@/types/api";
import { NextResponse } from "next/server";

export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

export function createErrorResponse(
  error: string,
  status: number = 400,
  details?: string
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { message: details }),
    },
    { status }
  );
}

export function createValidationErrorResponse(
  errors: string[]
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      message: errors.join(", "),
    },
    { status: 400 }
  );
}

// Common HTTP status responses
export const responses = {
  badRequest: (error: string, details?: string) =>
    createErrorResponse(error, 400, details),

  unauthorized: (error: string = "Unauthorized") =>
    createErrorResponse(error, 401),

  forbidden: (error: string = "Forbidden") => createErrorResponse(error, 403),

  notFound: (error: string = "Not found") => createErrorResponse(error, 404),

  methodNotAllowed: () => createErrorResponse("Method not allowed", 405),

  internalError: (error: string = "Internal server error") =>
    createErrorResponse(error, 500),

  success: <T>(data?: T, message?: string) =>
    createSuccessResponse(data, message),

  created: <T>(data?: T, message?: string) =>
    createSuccessResponse(data, message, 201),

  noContent: () => new NextResponse(null, { status: 204 }),
};
