import type { ProblemDetails } from '../types/api'

type QueryValue = string | number | boolean | null | undefined
type QueryObject = object

interface ApiRequestOptions<TBody> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: QueryObject
  body?: TBody
  signal?: AbortSignal
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  problem: ProblemDetails | null

  constructor(status: number, problem: ProblemDetails | null, fallbackMessage: string) {
    super(problem?.detail || problem?.title || fallbackMessage)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

export function getConfiguredApiBaseUrl() {
  return configuredApiBaseUrl
}

export function getBackendOrigin() {
  return configuredApiBaseUrl || window.location.origin
}

function buildQueryString(query?: QueryObject) {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query as Record<string, QueryValue>)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    params.set(key, String(value))
  }

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

function buildApiUrl(path: string, query?: QueryObject) {
  const queryString = buildQueryString(query)
  return configuredApiBaseUrl
    ? `${configuredApiBaseUrl}${path}${queryString}`
    : `${path}${queryString}`
}

function isJsonLike(contentType: string, text: string) {
  if (
    contentType.includes('application/json') ||
    contentType.includes('text/json') ||
    contentType.includes('application/problem+json')
  ) {
    return true
  }

  const trimmed = text.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return undefined
  }

  const text = await response.text()
  if (!text) {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (isJsonLike(contentType, text)) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  return text
}

function toProblemDetails(value: unknown): ProblemDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as ProblemDetails
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData
}

export async function apiRequest<TResponse, TBody = undefined>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
) {
  const { method = 'GET', query, body, signal } = options
  const headers: Record<string, string> = {
    Accept: 'application/json, text/json, text/plain',
  }

  if (body !== undefined && !isFormData(body)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(buildApiUrl(path, query), {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData(body)
          ? body
          : JSON.stringify(body),
    signal,
  })

  const parsedBody = await parseResponseBody(response)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      toProblemDetails(parsedBody),
      `Request failed with status ${response.status}`,
    )
  }

  return parsedBody as TResponse
}
