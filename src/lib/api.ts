import type { StationLookupResponse, StationSummary } from '../../shared/contracts'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

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
