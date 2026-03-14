import type {
  AuthUser,
  ChangePasswordRequest,
  CreatePrintJobRequest,
  CreatePrintJobResponse,
  CreateUserRequest,
  CreateUserResponse,
  LoginRequest,
  LoginResponse,
  ManagedUser,
  PrintJobListResponse,
  ResetPasswordRequest,
  SessionResponse,
  StationListResponse,
  StationLookupResponse,
  StationSummary,
  PrintJobStatus,
  UserListResponse,
} from '../../shared/contracts'

const AUTH_TOKEN_KEY = 'photobox_dashboard_token'
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ??
  (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '')

function createLocalStation(slug: string): StationSummary {
  return {
    id: `local-${slug}`,
    slug,
    name: `Station ${slug.toUpperCase()}`,
    location: 'Local development fallback',
    status: 'active',
  }
}

function getAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  if (!API_BASE_URL) {
    throw new Error('Backend API is not configured.')
  }

  const headers = new Headers(init.headers)
  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const fallbackMessage = 'Request failed.'

    try {
      const body = (await response.json()) as { error?: string }
      throw new Error(body.error ?? fallbackMessage)
    } catch {
      throw new Error(fallbackMessage)
    }
  }

  return response
}

export async function resolveStationBySlug(slug: string): Promise<StationLookupResponse> {
  if (!API_BASE_URL) {
    return { station: createLocalStation(slug) }
  }

  const response = await fetch(`${API_BASE_URL}/api/public/stations/${slug}`)

  if (!response.ok) {
    throw new Error(`Unable to load station ${slug}.`)
  }

  return (await response.json()) as StationLookupResponse
}

export async function createPrintJob(payload: CreatePrintJobRequest, pdfBlob: Blob) {
  if (!API_BASE_URL) {
    throw new Error('Backend API is not configured. Set VITE_API_BASE_URL to submit print jobs.')
  }

  const formData = new FormData()
  formData.append('stationSlug', payload.stationSlug)
  formData.append('templateId', payload.templateId)
  formData.append('slotCount', String(payload.slotCount))
  formData.append('totalAmount', String(payload.totalAmount ?? 0))
  formData.append(
    'file',
    new File([pdfBlob], `print-${payload.stationSlug}.pdf`, { type: 'application/pdf' }),
  )

  const response = await fetch(`${API_BASE_URL}/api/public/print-jobs`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const fallbackMessage = 'Unable to create the print job.'

    try {
      const body = (await response.json()) as { error?: string }
      throw new Error(body.error ?? fallbackMessage)
    } catch {
      throw new Error(fallbackMessage)
    }
  }

  return (await response.json()) as CreatePrintJobResponse
}

export async function listStations() {
  if (!API_BASE_URL) {
    return {
      stations: ['tram1', 'tram2', 'tram3'].map((slug) => createLocalStation(slug)),
    } satisfies StationListResponse
  }

  const response = await apiFetch('/api/admin/stations')
  return (await response.json()) as StationListResponse
}

export async function listPrintJobs() {
  if (!API_BASE_URL) {
    return {
      jobs: [],
    } satisfies PrintJobListResponse
  }

  const response = await apiFetch('/api/operator/print-jobs')
  return (await response.json()) as PrintJobListResponse
}

export async function updatePrintJobStatus(id: string, status: PrintJobStatus) {
  const response = await apiFetch(`/api/operator/print-jobs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  return response.json()
}

export async function getPrintJobFileBlob(id: string) {
  const response = await apiFetch(`/api/operator/print-jobs/${id}/file`)
  return await response.blob()
}

export async function loginDashboard(payload: LoginRequest) {
  if (!API_BASE_URL) {
    throw new Error('Backend API is not configured.')
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const fallbackMessage = 'Unable to login.'

    try {
      const body = (await response.json()) as { error?: string }
      throw new Error(body.error ?? fallbackMessage)
    } catch {
      throw new Error(fallbackMessage)
    }
  }

  const data = (await response.json()) as LoginResponse
  setAuthToken(data.token)
  return data
}

export async function getCurrentUser() {
  const token = getAuthToken()

  if (!token) {
    return null
  }

  try {
    const response = await apiFetch('/api/auth/me')
    const data = (await response.json()) as SessionResponse
    return data.user
  } catch {
    clearAuthToken()
    return null
  }
}

export async function logoutDashboard() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearAuthToken()
  }
}

export async function listUsers() {
  const response = await apiFetch('/api/admin/users')
  return (await response.json()) as UserListResponse
}

export async function createUser(payload: CreateUserRequest) {
  const response = await apiFetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await response.json()) as CreateUserResponse
}

export async function deleteUser(userId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  })
  return await response.json()
}

export async function resetUserPassword(userId: string, payload: ResetPasswordRequest) {
  const response = await apiFetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return await response.json()
}

export async function changeOwnPassword(payload: ChangePasswordRequest) {
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return await response.json()
}

export type { AuthUser, ManagedUser }
