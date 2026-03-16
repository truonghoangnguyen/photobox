import { Hono } from 'hono'
import type {
  ApiErrorResponse,
  CreatePrintJobResponse,
  PrintJobSummary,
  StationLookupResponse,
} from '../../../shared/contracts'
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
  const formData = await context.req.formData()
  const stationSlug = formData.get('stationSlug')
  const templateId = formData.get('templateId')
  const slotCountRaw = formData.get('slotCount')
  const totalAmountRaw = formData.get('totalAmount')
  const status = formData.get('status')
  const pageCountRaw = formData.get('pageCount')
  const pricePerPageRaw = formData.get('pricePerPage')
  const customerName = formData.get('customerName')
  const customerPhoneSuffix = formData.get('customerPhoneSuffix')
  const quantityRaw = formData.get('quantity')
  const file = formData.get('file')

  if (
    typeof stationSlug !== 'string' ||
    typeof templateId !== 'string' ||
    typeof slotCountRaw !== 'string' ||
    !(file instanceof File)
  ) {
    return context.json<ApiErrorResponse>({ error: 'Invalid print job payload.' }, 400)
  }

  const slotCount = Number(slotCountRaw)
  const totalAmount = Number(totalAmountRaw ?? 0)
  const pageCount = pageCountRaw ? Number(pageCountRaw) : null
  const pricePerPage = pricePerPageRaw ? Number(pricePerPageRaw) : null
  const quantity = quantityRaw ? Number(quantityRaw) : 1

  if (!Number.isFinite(slotCount) || slotCount <= 0) {
    return context.json<ApiErrorResponse>({ error: 'slotCount must be a positive number.' }, 400)
  }

  const stationRow = await context.env.DB.prepare(
    'SELECT id, slug, name, location, status FROM stations WHERE slug = ? LIMIT 1',
  )
    .bind(stationSlug)
    .first<StationRow>()

  if (!stationRow) {
    return context.json<ApiErrorResponse>({ error: `Station ${stationSlug} was not found.` }, 404)
  }

  if (stationRow.status !== 'active') {
    return context.json<ApiErrorResponse>({ error: `Station ${stationSlug} is inactive.` }, 409)
  }

  const jobId = crypto.randomUUID()
  const invoiceId = crypto.randomUUID()
  const jobCode = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const invoiceCode = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const r2Key = `stations/${stationSlug}/print-jobs/${jobId}/${file.name}`

  await context.env.ASSETS.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/pdf',
    },
  })

  await context.env.DB.prepare(
    `
      INSERT INTO print_jobs (
        id,
        station_id,
        job_code,
        status,
        total_amount,
        output_r2_key,
        template_id,
        slot_count,
        page_count,
        price_per_page,
        customer_name,
        customer_phone_suffix,
        quantity
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      jobId,
      stationRow.id,
      jobCode,
      typeof status === 'string' ? status : 'pending',
      totalAmount,
      r2Key,
      templateId,
      slotCount,
      pageCount,
      pricePerPage,
      typeof customerName === 'string' ? customerName : null,
      typeof customerPhoneSuffix === 'string' ? customerPhoneSuffix : null,
      quantity,
    )
    .run()

  await context.env.DB.prepare(
    `
      INSERT INTO invoices (
        id,
        print_job_id,
        invoice_code,
        subtotal,
        tax_amount,
        total_amount
      )
      VALUES (?, ?, ?, ?, 0, ?)
    `,
  )
    .bind(invoiceId, jobId, invoiceCode, totalAmount, totalAmount)
    .run()

  const job: PrintJobSummary = {
    id: jobId,
    stationId: stationRow.id,
    stationSlug: stationSlug,
    jobCode,
    status: (typeof status === 'string' ? status : 'pending') as any,
    totalAmount,
    outputR2Key: r2Key,
    templateId,
    slotCount,
    pageCount: pageCount ?? undefined,
    pricePerPage: pricePerPage ?? undefined,
    customerName: typeof customerName === 'string' ? customerName : undefined,
    customerPhoneSuffix: typeof customerPhoneSuffix === 'string' ? customerPhoneSuffix : undefined,
    quantity,
    createdAt: new Date().toISOString(),
  }

  return context.json<CreatePrintJobResponse>({ job }, 201)
})

publicRoutes.get('/print-jobs/:id', async (context) => {
  const id = context.req.param('id')
  const row = await context.env.DB.prepare(
    `
      SELECT 
        pj.id, 
        pj.station_id, 
        s.slug as station_slug,
        pj.job_code, 
        pj.status, 
        pj.total_amount, 
        pj.output_r2_key,
        pj.template_id,
        pj.slot_count,
        pj.page_count,
        pj.price_per_page,
        pj.customer_name,
        pj.customer_phone_suffix,
        pj.quantity,
        pj.created_at
      FROM print_jobs pj
      JOIN stations s ON pj.station_id = s.id
      WHERE pj.id = ? 
      LIMIT 1
    `,
  )
    .bind(id)
    .first<{
      id: string
      station_id: string
      station_slug: string
      job_code: string
      status: string
      total_amount: number
      output_r2_key: string
      template_id: string
      slot_count: number
      page_count: number | null
      price_per_page: number | null
      customer_name: string | null
      customer_phone_suffix: string | null
      quantity: number
      created_at: string
    }>()

  if (!row) {
    return context.json<ApiErrorResponse>({ error: `Print job ${id} was not found.` }, 404)
  }

  const job: PrintJobSummary = {
    id: row.id,
    stationId: row.station_id,
    stationSlug: row.station_slug,
    jobCode: row.job_code,
    status: row.status as any,
    totalAmount: row.total_amount,
    outputR2Key: row.output_r2_key,
    templateId: row.template_id,
    slotCount: row.slot_count,
    pageCount: row.page_count ?? undefined,
    pricePerPage: row.price_per_page ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerPhoneSuffix: row.customer_phone_suffix ?? undefined,
    quantity: row.quantity,
    createdAt: row.created_at,
  }

  return context.json<{ job: PrintJobSummary }>({ job })
})

publicRoutes.delete('/print-jobs/:id', async (context) => {
  const id = context.req.param('id')

  const row = await context.env.DB.prepare('SELECT id, status FROM print_jobs WHERE id = ? LIMIT 1')
    .bind(id)
    .first<{ id: string; status: string }>()

  if (!row) {
    return context.json<ApiErrorResponse>({ error: `Print job ${id} was not found.` }, 404)
  }

  if (row.status !== 'draft' && row.status !== 'pending') {
    return context.json<ApiErrorResponse>(
      { error: `Cannot cancel job in ${row.status} status.` },
      400,
    )
  }

  await context.env.DB.prepare('UPDATE print_jobs SET status = ? WHERE id = ?')
    .bind('cancelled', id)
    .run()

  return context.json({ success: true, id })
})
