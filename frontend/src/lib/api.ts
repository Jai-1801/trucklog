const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string[]> }
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fields?: Record<string, string[]>

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.fields = body.fields
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Could not reach the server. Check your connection and try again.' })
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error
    throw new ApiError(response.status, error ?? { code: 'UNKNOWN', message: `Request failed (${response.status}).` })
  }
  return body as T
}

export type Health = { ok: boolean; version: string; routing_configured: boolean }

export const getHealth = () => apiFetch<Health>('/api/health')
