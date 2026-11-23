import type { PaymentRecord } from '../features/payments/model/paymentTypes'
import type { RoomRecord, SeatRecord } from '../features/operations/model/operationTypes'
import type { Trip } from '../features/trips/model/tripTypes'
import type { SystemUser } from '../features/users/model/userTypes'

export interface DemoState {
  passwords: Record<string, string>
  payments: PaymentRecord[]
  rooms: RoomRecord[]
  seats: SeatRecord[]
  trips: Trip[]
  users: SystemUser[]
}

const STATE_KEY = 'igreja-viagens:demo-state'
export const DEMO_SESSION_KEY = 'igreja-viagens:demo-session'

const users: SystemUser[] = [
  { cpf: '52998224725', name: 'Mariana Oliveira', role: 'admin', birthdate: '1984-05-18', firstLogin: false, married: true, spouseName: 'Ricardo Oliveira', spouseCpf: '11144477735', hasKids: true, kids: ['Lucas Oliveira'], childCpfs: ['12345678909'] },
  { cpf: '11144477735', name: 'Ricardo Oliveira', role: 'traveler', birthdate: '1982-09-22', firstLogin: false, married: true, spouseName: 'Mariana Oliveira', spouseCpf: '52998224725', hasKids: true, kids: ['Lucas Oliveira'], childCpfs: ['12345678909'] },
  { cpf: '12345678909', name: 'Lucas Oliveira', role: 'traveler', birthdate: '2012-02-10', firstLogin: false, married: false, spouseName: '', spouseCpf: '', hasKids: false, kids: [], childCpfs: [] },
  { cpf: '93541134780', name: 'Ana Souza', role: 'traveler', birthdate: '1990-11-03', firstLogin: false, married: false, spouseName: '', spouseCpf: '', hasKids: false, kids: [], childCpfs: [] },
  { cpf: '71460238001', name: 'Paulo Mendes', role: 'traveler', birthdate: '1977-07-14', firstLogin: false, married: true, spouseName: 'Clara Mendes', spouseCpf: '98765432100', hasKids: false, kids: [], childCpfs: [] },
  { cpf: '98765432100', name: 'Clara Mendes', role: 'traveler', birthdate: '1979-04-26', firstLogin: false, married: true, spouseName: 'Paulo Mendes', spouseCpf: '71460238001', hasKids: false, kids: [], childCpfs: [] },
]

const trip: Trip = {
  id: 'demo-petropolis-2027', version: 1, updatedAt: '2026-11-23T12:00:00.000Z',
  name: 'Retiro de Famílias 2027', destination: 'Petrópolis, RJ',
  departurePlace: 'Igreja Comunidade da Fé', departureTime: '06:30', date: '2027-04-16',
  maxPeople: 44, price: 780, arrecadationGoal: 34320,
  rules: 'Levar documento com foto. Apresentação no local de saída às 6h. Check-in no hotel a partir das 14h.',
  buses: [{ id: 'bus-demo-1', label: 'Ônibus Esperança', company: 'Viação Caminhos', plate: 'RJV2A27', driverName: 'José Carlos', floors: 1, seatsFloor1: 44, seatsFloor2: 0, seats: 44 }],
  hotelsJson: JSON.stringify([{ id: 'hotel-serra', name: 'Hotel Serra da Estrela', address: 'Rua do Imperador, 545, Petrópolis - RJ', notes: 'Café da manhã incluso e salão reservado para o grupo.', rooms: [
    { id: 'room-101', name: 'Suíte 101', type: 'Casal', capacity: 2 },
    { id: 'room-102', name: 'Quarto 102', type: 'Família', capacity: 3 },
    { id: 'room-201', name: 'Quarto 201', type: 'Duplo', capacity: 2 },
    { id: 'room-202', name: 'Quarto 202', type: 'Duplo', capacity: 2 },
  ] }]),
  travelersJson: JSON.stringify(users.map((user) => user.cpf)), travelerCpfs: users.map((user) => user.cpf),
}

const initial: DemoState = {
  users,
  passwords: Object.fromEntries(users.map((user) => [user.cpf, 'demo12345'])),
  trips: [trip],
  rooms: [
    { id: 'room-101', tripId: trip.id, hotelId: 'hotel-serra', name: 'Suíte 101', type: 'Casal', capacity: 2, occupants: ['52998224725', '11144477735'] },
    { id: 'room-102', tripId: trip.id, hotelId: 'hotel-serra', name: 'Quarto 102', type: 'Família', capacity: 3, occupants: ['12345678909'] },
    { id: 'room-201', tripId: trip.id, hotelId: 'hotel-serra', name: 'Quarto 201', type: 'Duplo', capacity: 2, occupants: ['93541134780', '71460238001'] },
    { id: 'room-202', tripId: trip.id, hotelId: 'hotel-serra', name: 'Quarto 202', type: 'Duplo', capacity: 2, occupants: ['98765432100'] },
  ],
  seats: [
    ['52998224725', 1], ['11144477735', 2], ['12345678909', 3], ['93541134780', 7], ['71460238001', 8], ['98765432100', 9],
  ].map(([userCpf, seatNumber]) => ({ id: `seat-${seatNumber}`, tripId: trip.id, busId: 'bus-demo-1', floor: 1, seatNumber: Number(seatNumber), userCpf: String(userCpf) })),
  payments: [
    { id: 'payment-mariana', tripId: trip.id, userCpf: '52998224725', totalInstallments: 3, paidInstallments: 3, dueDay: 10, locked: true, receipts: { '1': { data: '', date: '2026-10-10', filename: 'pix-outubro.pdf', note: 'Pagamento confirmado', status: 'approved', type: 'application/pdf' }, '2': { data: '', date: '2026-11-10', filename: 'pix-novembro.pdf', note: 'Pagamento confirmado', status: 'approved', type: 'application/pdf' } } },
    { id: 'payment-ricardo', tripId: trip.id, userCpf: '11144477735', totalInstallments: 3, paidInstallments: 2, dueDay: 10, locked: true, receipts: { '1': { data: '', date: '2026-10-10', filename: 'pix-outubro.pdf', note: 'Pagamento confirmado', status: 'approved', type: 'application/pdf' } } },
    { id: 'payment-ana', tripId: trip.id, userCpf: '93541134780', totalInstallments: 3, paidInstallments: 1, dueDay: 15, locked: true, receipts: { '1': { data: '', date: '2026-10-15', filename: 'transferencia.pdf', note: 'Aguardando conferência', status: 'pending', type: 'application/pdf' } } },
    { id: 'payment-paulo', tripId: trip.id, userCpf: '71460238001', totalInstallments: 3, paidInstallments: 0, dueDay: 15, locked: true, receipts: {} },
  ],
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

export function readDemoState(): DemoState {
  try {
    const saved = localStorage.getItem(STATE_KEY)
    if (saved) return JSON.parse(saved) as DemoState
  } catch { /* A demonstração continua com os dados iniciais. */ }
  const state = clone(initial)
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
  return state
}

export function writeDemoState(state: DemoState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

export function updateDemoState(mutator: (state: DemoState) => void) {
  const state = readDemoState()
  mutator(state)
  writeDemoState(state)
  return state
}

export function nextDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
