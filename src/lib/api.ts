import type {
  CreatePrintJobRequest,
  CreatePrintJobResponse,
  PrintJobListResponse,
  StationListResponse,
  StationLookupResponse,
  StationSummary,
  PrintJobStatus,
} from '../../shared/contracts'

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

  const response = await fetch(`${API_BASE_URL}/api/admin/stations`)

  if (!response.ok) {
    throw new Error('Unable to load stations.')
  }

  return (await response.json()) as StationListResponse
}

export async function listPrintJobs() {
  if (!API_BASE_URL) {
    return {
      jobs: [],
    } satisfies PrintJobListResponse
  }

  const response = await fetch(`${API_BASE_URL}/api/operator/print-jobs`)

  if (!response.ok) {
    throw new Error('Unable to load print jobs.')
  }

  return (await response.json()) as PrintJobListResponse
}

export async function updatePrintJobStatus(id: string, status: PrintJobStatus) {
  if (!API_BASE_URL) {
    throw new Error('Backend API is not configured.')
  }

  const response = await fetch(`${API_BASE_URL}/api/operator/print-jobs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    const fallbackMessage = 'Unable to update print job status.'
    try {
      const body = (await response.json()) as { error?: string }
      throw new Error(body.error ?? fallbackMessage)
    } catch {
      throw new Error(fallbackMessage)
    }
  }

  return response.json()
}

export function getPrintJobFileUrl(id: string): string {
  if (!API_BASE_URL) return ''
  return `${API_BASE_URL}/api/operator/print-jobs/${id}/file`
}
