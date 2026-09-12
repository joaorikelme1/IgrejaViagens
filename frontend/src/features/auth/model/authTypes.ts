export type UserRole = 'admin' | 'traveler'

export interface AuthUser {
  cpf: string
  name: string
  role: UserRole
  birthdate: string
  firstLogin: boolean
  married: boolean
  spouseName: string
  hasKids: boolean
  kids: string[]
  profilePhoto?: string
}

export interface LoginCredentials {
  cpf: string
  password: string
}
