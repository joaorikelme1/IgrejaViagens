import { environment } from './env'

export interface ApiErrorPayload {
  message?: string
  status?: number
  [key: string]: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: ApiErrorPayload | string | null

  constructor(
    message: string,
    status: number,
    payload: ApiErrorPayload | string | null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
  skipUnauthorizedNotification?: boolean
}

type UnauthorizedListener = () => void

interface CsrfCredentials {
  headerName: string
  token: string
}

const unauthorizedListeners = new Set<UnauthorizedListener>()
let csrfCredentials: CsrfCredentials | null = null
let csrfRequest: Promise<CsrfCredentials> | null = null

export function subscribeToUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

function notifyUnauthorized() {
  resetHttpSecurityState()
  unauthorizedListeners.forEach((listener) => listener())
}

export function resetHttpSecurityState() {
  csrfCredentials = null
  csrfRequest = null
}

function resolveUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${environment.apiBaseUrl}${normalizedPath}`
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as unknown
  }

  const text = await response.text()
  return text || null
}

function isUnsafeMethod(method?: string) {
  return ['DELETE', 'PATCH', 'POST', 'PUT'].includes(
    (method ?? 'GET').toUpperCase(),
  )
}

async function loadCsrfCredentials(timeoutMs: number) {
  if (csrfCredentials) return csrfCredentials
  if (csrfRequest) return csrfRequest

  csrfRequest = httpRequest<unknown>('/auth/csrf', {
    timeoutMs,
    skipUnauthorizedNotification: true,
  })
    .then((payload) => {
      if (typeof payload !== 'object' || payload === null) {
        throw new Error('Resposta de proteção CSRF inválida.')
      }
      const source = payload as Record<string, unknown>
      if (typeof source.headerName !== 'string' || typeof source.token !== 'string') {
        throw new Error('Resposta de proteção CSRF inválida.')
      }
      csrfCredentials = {
        headerName: source.headerName,
        token: source.token,
      }
      return csrfCredentials
    })
    .finally(() => {
      csrfRequest = null
    })

  return csrfRequest
}

export async function httpRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = 10_000,
    headers,
    skipUnauthorizedNotification = false,
    ...requestOptions
  } = options
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }
  if (isUnsafeMethod(requestOptions.method)) {
    const csrf = await loadCsrfCredentials(timeoutMs)
    requestHeaders.set(csrf.headerName, csrf.token)
  }
  const abortController = new AbortController()
  const timeout = window.setTimeout(() => abortController.abort(), timeoutMs)

  try {
    const response = await fetch(resolveUrl(path), {
      ...requestOptions,
      credentials: 'include',
      headers: requestHeaders,
      signal: abortController.signal,
    })
    const payload = await parseResponse(response)

    if (!response.ok) {
      if (response.status === 401 && !skipUnauthorizedNotification) {
        notifyUnauthorized()
      }

      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as ApiErrorPayload | null)?.message ??
            'Não foi possível concluir a requisição.')

      throw new ApiError(
        message,
        response.status,
        payload as ApiErrorPayload | string | null,
      )
    }

    return payload as T
  } finally {
    window.clearTimeout(timeout)
  }
}
