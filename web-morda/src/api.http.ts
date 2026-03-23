import type { ProblemDetails } from './api.types';

export class ApiError extends Error {
  status: number;

  problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null && ('title' in value || 'status' in value || 'detail' in value);
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJsonResponse =
    contentType.includes('application/json')
    || contentType.includes('text/json')
    || contentType.includes('application/problem+json')
    || contentType.includes('+json');
  if (isJsonResponse) {
    return response.json();
  }

  const text = await response.text();
  return text.length ? text : null;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await parseBody(response);

  if (!response.ok) {
    const problem = isProblemDetails(body) ? body : undefined;
    const message = problem?.detail ?? problem?.title ?? `HTTP ${response.status}`;
    throw new ApiError(response.status, message, problem);
  }

  return body as T;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}
