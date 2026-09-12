export interface BusConfig {
  id: string | number
  floors: number
  seatsFloor1: number
  seatsFloor2: number
  seats: number
  [key: string]: unknown
}

export interface Trip {
  id: string
  name: string
  destination: string
  departurePlace: string
  departureTime: string
  date: string
  maxPeople: number
  price: number
  arrecadationGoal: number
  rules: string
  buses: BusConfig[]
  hotelsJson: string
  travelersJson: string
  travelerCpfs: string[]
}

export interface TripMutation {
  name: string
  destination: string
  departurePlace: string
  departureTime: string
  date: string
  maxPeople: number
  price: number
  arrecadationGoal: number
  rules: string
  buses: BusConfig[]
}
