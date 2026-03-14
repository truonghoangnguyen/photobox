export type StationStatus = 'active' | 'inactive'

export type PrintJobStatus =
  | 'draft'
  | 'pending'
  | 'processing'
  | 'printed'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface StationSummary {
  id: string
  slug: string
  name: string
  location: string | null
  status: StationStatus
}

export interface StationLookupResponse {
  station: StationSummary
}

export interface StationListResponse {
  stations: StationSummary[]
}

export interface PrintJobSummary {
  id: string
  stationId: string
  stationSlug: string
  jobCode: string
  status: PrintJobStatus
  totalAmount: number
  outputR2Key?: string
  templateId?: string
  slotCount?: number
  createdAt: string
}

export interface ApiErrorResponse {
  error: string
}

export interface CreatePrintJobRequest {
  stationSlug: string
  templateId: string
  slotCount: number
  totalAmount?: number
}

export interface CreatePrintJobResponse {
  job: PrintJobSummary
}

export interface PrintJobListResponse {
  jobs: PrintJobSummary[]
}
