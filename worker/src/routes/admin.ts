import { Hono } from 'hono'
import type { StationListResponse } from '../../../shared/contracts'
import type { AppContext, StationRow } from '../types'
import { toStationSummary } from '../types'

export const adminRoutes = new Hono<AppContext>()

adminRoutes.get('/stations', async (context) => {
  const rows = await context.env.DB.prepare(
    'SELECT id, slug, name, location, status FROM stations ORDER BY created_at DESC',
  ).all<StationRow>()

  return context.json<StationListResponse>({
    stations: (rows.results ?? []).map(toStationSummary),
  })
})
