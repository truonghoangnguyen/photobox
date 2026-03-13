import type { StationSummary } from '../../shared/contracts'

export interface AppBindings {
  DB: D1Database
  ASSETS: R2Bucket
  APP_URL?: string
}

export interface AppContext {
  Bindings: AppBindings
}

export interface StationRow {
  id: string
  slug: string
  name: string
  location: string | null
  status: string
}

export function toStationSummary(row: StationRow): StationSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.location,
    status: row.status === 'inactive' ? 'inactive' : 'active',
  }
}
