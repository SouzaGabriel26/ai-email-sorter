export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Gmail-specific types
export interface EmailProcessingResult {
  processed: number;
  duplicates: number;
  archived?: number; // Optional for backward compatibility
  messages: string[];
}

export interface AccountMatchResult {
  accountId: string;
  emailAddress: string;
  matched: boolean;
}

// Validation error type
export interface ValidationError {
  field: string;
  message: string;
}
