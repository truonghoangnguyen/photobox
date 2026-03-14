import { Hono } from 'hono'
import type { ApiErrorResponse, PrintJobListResponse, PrintJobSummary } from '../../../shared/contracts'
import type { AppContext } from '../types'

export const operatorRoutes = new Hono<AppContext>()

operatorRoutes.get('/print-jobs', async (context) => {
  const stationSlug = context.req.query('stationSlug')

  let query = `
      SELECT
        pj.id,
        pj.station_id AS stationId,
        s.slug AS stationSlug,
        pj.job_code AS jobCode,
        pj.status,
        pj.total_amount AS totalAmount,
        pj.output_r2_key AS outputR2Key,
        pj.template_id AS templateId,
        pj.slot_count AS slotCount,
        pj.created_at AS createdAt
      FROM print_jobs pj
      JOIN stations s ON s.id = pj.station_id
  `
  const params: any[] = []

  if (stationSlug) {
    query += ` WHERE s.slug = ?`
    params.push(stationSlug)
  }

  query += ` ORDER BY pj.created_at DESC LIMIT 50`

  const rows = await context.env.DB.prepare(query)
    .bind(...params)
    .all<PrintJobSummary>()

  return context.json<PrintJobListResponse>({
    jobs: rows.results ?? [],
  })
})

operatorRoutes.patch('/print-jobs/:id/status', async (context) => {
  const id = context.req.param('id')
  const body = (await context.req.json<{ status?: string }>().catch(() => ({}))) as { status?: string }
  
  if (!body || !body.status) {
    return context.json<ApiErrorResponse>({ error: 'Missing status payload.' }, 400)
  }

  const validStatuses = ['draft', 'pending', 'processing', 'printed', 'completed', 'failed', 'cancelled']
  if (!validStatuses.includes(body.status)) {
    return context.json<ApiErrorResponse>({ error: 'Invalid status.' }, 400)
  }

  const result = await context.env.DB.prepare(
    'UPDATE print_jobs SET status = ? WHERE id = ?'
  )
    .bind(body.status, id)
    .run()

  if (result.meta.changes === 0) {
    return context.json<ApiErrorResponse>({ error: 'Print job not found.' }, 404)
  }

  return context.json({ success: true })
})

operatorRoutes.get('/print-jobs/:id/file', async (context) => {
  const id = context.req.param('id')

  const job = await context.env.DB.prepare(
    'SELECT output_r2_key AS outputR2Key FROM print_jobs WHERE id = ? LIMIT 1'
  )
    .bind(id)
    .first<{ outputR2Key: string | null }>()

  if (!job || !job.outputR2Key) {
    return context.json<ApiErrorResponse>({ error: 'File not found for this print job.' }, 404)
  }

  const file = await context.env.ASSETS.get(job.outputR2Key)

  if (!file) {
    return context.json<ApiErrorResponse>({ error: 'File not found in storage.' }, 404)
  }

  const headers = new Headers()
  file.writeHttpMetadata(headers)
  headers.set('etag', file.httpEtag)

  return new Response(file.body, {
    headers,
  })
})
