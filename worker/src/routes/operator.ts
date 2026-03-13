import { Hono } from 'hono'
import type { PrintJobSummary } from '../../../shared/contracts'
import type { AppContext } from '../types'

export const operatorRoutes = new Hono<AppContext>()

operatorRoutes.get('/print-jobs', async (context) => {
  const rows = await context.env.DB.prepare(
    `
      SELECT
        pj.id,
        pj.station_id AS stationId,
        s.slug AS stationSlug,
        pj.job_code AS jobCode,
        pj.status,
        pj.total_amount AS totalAmount,
        pj.created_at AS createdAt
      FROM print_jobs pj
      JOIN stations s ON s.id = pj.station_id
      ORDER BY pj.created_at DESC
      LIMIT 50
    `,
  ).all<PrintJobSummary>()

  return context.json({
    jobs: rows.results ?? [],
  })
})
