export type StationStatus = 'active' | 'inactive'

export type PrintJobStatus =
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

export interface PrintJobSummary {
  id: string
  stationId: string
  stationSlug: string
  jobCode: string
  status: PrintJobStatus
  totalAmount: number
  createdAt: string
}

export interface ApiErrorResponse {
  error: string
}
