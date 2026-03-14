import type { AuthUser, StationSummary } from '../../shared/contracts'

export interface AppBindings {
  DB: D1Database
  ASSETS: R2Bucket
  APP_URL?: string
}

export interface AppContext {
  Bindings: AppBindings
}

export interface SessionUserRow {
  id: string
  username: string
  name: string
  role: string
  stationId: string | null
  stationSlug: string | null
  stationName: string | null
}

export interface ManagedUserRow {
  id: string
  username: string
  name: string
  role: string
  stationId: string | null
  stationSlug: string | null
  stationName: string | null
  createdAt: string
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

export function toAuthUser(row: SessionUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role === 'super_admin' ? 'super_admin' : 'station_operator',
    stationId: row.stationId,
    stationSlug: row.stationSlug,
    stationName: row.stationName,
  }
}
