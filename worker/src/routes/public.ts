import { Hono } from 'hono'
import type { ApiErrorResponse, StationLookupResponse } from '../../../shared/contracts'
import type { AppContext, StationRow } from '../types'
import { toStationSummary } from '../types'

export const publicRoutes = new Hono<AppContext>()

publicRoutes.get('/stations/:slug', async (context) => {
  const slug = context.req.param('slug')
  const row = await context.env.DB.prepare(
    'SELECT id, slug, name, location, status FROM stations WHERE slug = ? LIMIT 1',
  )
    .bind(slug)
    .first<StationRow>()

  if (!row) {
    return context.json<ApiErrorResponse>({ error: `Station ${slug} was not found.` }, 404)
  }

  return context.json<StationLookupResponse>({
    station: toStationSummary(row),
  })
})

publicRoutes.post('/uploads/init', async (context) => {
  return context.json(
    {
      ok: false,
      message: 'Upload signing scaffold is ready. Implement R2 signed upload flow next.',
    },
    501,
  )
})

publicRoutes.post('/print-jobs', async (context) => {
  return context.json(
    {
      ok: false,
      message: 'Print job creation scaffold is ready. Implement validation and D1 inserts next.',
    },
    501,
  )
})
