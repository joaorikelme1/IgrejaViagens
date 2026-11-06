export type AiPlanningFocus = 'ALL' | 'ROOMS' | 'SEATS'
export type AiPlanStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'GENERATED'
  | 'FAILED'
  | 'STALE'
  | 'APPLIED'
  | 'DISCARDED'

export interface AiRoomCreation {
  key: string
  hotel: string
  name: string
  type: string
  capacity: number
  reason: string
}

export interface AiRoomAssignment {
  traveler: string
  room: string
  reason: string
}

export interface AiSeatAssignment {
  traveler: string
  bus: string
  floor: number
  seatNumber: number
  reason: string
}

export interface AiPlanResult {
  summary: string
  roomCreations: AiRoomCreation[]
  roomAssignments: AiRoomAssignment[]
  seatAssignments: AiSeatAssignment[]
  warnings: string[]
}

export interface AiPlan {
  id: string
  tripId: string
  status: AiPlanStatus
  focus: AiPlanningFocus
  provider: string
  model: string
  providerRequestId: string | null
  promptVersion: string
  snapshotHash: string
  currentSnapshot: boolean
  result: AiPlanResult | null
  travelerLabels: Record<string, string>
  busLabels: Record<string, string>
  hotelLabels: Record<string, string>
  roomLabels: Record<string, string>
  inputTokens: number | null
  outputTokens: number | null
  estimatedCost: number | null
  errorCode: string | null
  createdAt: string
  updatedAt: string
  appliedAt: string | null
}

export interface AiPlanningStatus {
  available: boolean
  provider: string
  model: string
  generationCooldownSeconds: number
  maxRequestsPerAdminPerHour: number
  maxRequestsPerTripPerDay: number
}

export interface AiUsage {
  tripId: string
  requestsToday: number
  maxRequestsPerDay: number
  activeGenerations: number
}

export interface AiPlanApplication {
  planId: string
  roomsCreated: number
  travelersAssignedToRooms: number
  travelersAssignedToSeats: number
}

export type MobilityRequirement =
  | 'NONE'
  | 'PREFER_LOWER_FLOOR'
  | 'REQUIRE_LOWER_FLOOR'

export type SeatRegion = 'ANY' | 'FRONT' | 'MIDDLE' | 'BACK'

export interface TravelerPlanningPreference {
  userCpf: string
  mobilityRequirement: MobilityRequirement
  seatRegion: SeatRegion
  preferredBusFloor: number | null
  preferredRoomType: string | null
  includeInAiPlanning: boolean
  companionCpfs: string[]
  separatedFromCpfs: string[]
  version: number | null
  updatedAt: string | null
}

export type TravelerPlanningPreferenceMutation = Omit<
  TravelerPlanningPreference,
  'userCpf' | 'updatedAt'
>
