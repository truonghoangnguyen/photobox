export type StationStatus = 'active' | 'inactive'
export type UserRole = 'super_admin' | 'station_operator'

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
  pageCount?: number
  pricePerPage?: number
  customerName?: string
  customerPhoneSuffix?: string
  quantity: number
  createdAt: string
}

export interface ApiErrorResponse {
  error: string
}

export interface AuthUser {
  id: string
  username: string
  name: string
  role: UserRole
  stationId: string | null
  stationSlug: string | null
  stationName: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface SessionResponse {
  user: AuthUser
}

export interface CreatePrintJobRequest {
  stationSlug: string
  templateId: string
  slotCount: number
  totalAmount?: number
  status?: PrintJobStatus
  pageCount?: number
  pricePerPage?: number
  customerName?: string
  customerPhoneSuffix?: string
  quantity?: number
}

export interface CreatePrintJobResponse {
  job: PrintJobSummary
}

export interface PrintJobListResponse {
  jobs: PrintJobSummary[]
}

export interface ManagedUser {
  id: string
  username: string
  name: string
  role: UserRole
  stationId: string | null
  stationSlug: string | null
  stationName: string | null
  createdAt: string
}

export interface UserListResponse {
  users: ManagedUser[]
}

export interface CreateUserRequest {
  username: string
  password: string
  name: string
  stationId: string
}

export interface CreateUserResponse {
  user: ManagedUser
}

export interface ResetPasswordRequest {
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
