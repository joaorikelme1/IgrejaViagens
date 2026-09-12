import type { UserRole } from '../../auth/model/authTypes'
import type { AppIconName } from '../../../shared/components/AppIcon'

export interface NavigationItem {
  label: string
  path: string
  icon: AppIconName
  pageTitle: string
  description: string
  requiresTrip: boolean
}

export interface NavigationSection {
  label: string
  items: NavigationItem[]
}

export const navigationByRole: Record<UserRole, NavigationSection[]> = {
  admin: [
    {
      label: 'Principal',
      items: [
        {
          label: 'Dashboard',
          path: '/admin',
          icon: 'dashboard',
          pageTitle: 'Dashboard administrativo',
          description: 'Indicadores e acompanhamento da viagem ativa.',
          requiresTrip: true,
        },
        {
          label: 'Minha passagem',
          path: '/admin/minha-passagem',
          icon: 'plane',
          pageTitle: 'Minha passagem',
          description: 'Passagem digital do administrador na viagem ativa.',
          requiresTrip: true,
        },
        {
          label: 'Viajantes',
          path: '/admin/viajantes',
          icon: 'users',
          pageTitle: 'Viajantes',
          description: 'Pessoas e dados operacionais da viagem ativa.',
          requiresTrip: true,
        },
      ],
    },
    {
      label: 'Gestão',
      items: [
        {
          label: 'Pagamentos',
          path: '/admin/pagamentos',
          icon: 'creditCard',
          pageTitle: 'Pagamentos',
          description: 'Planos, comprovantes e arrecadação da viagem ativa.',
          requiresTrip: true,
        },
        {
          label: 'Transporte',
          path: '/admin/transporte',
          icon: 'bus',
          pageTitle: 'Transporte',
          description: 'Ônibus, pisos e distribuição de assentos da viagem ativa.',
          requiresTrip: true,
        },
        {
          label: 'Hotel',
          path: '/admin/hotel',
          icon: 'building',
          pageTitle: 'Hotel',
          description: 'Hotéis, quartos e ocupantes da viagem ativa.',
          requiresTrip: true,
        },
      ],
    },
    {
      label: 'Sistema',
      items: [
        {
          label: 'Cadastro Global',
          path: '/admin/cadastros',
          icon: 'folder',
          pageTitle: 'Cadastro global',
          description: 'Usuários do sistema e suas viagens associadas.',
          requiresTrip: false,
        },
        {
          label: 'Configurações',
          path: '/admin/configuracoes',
          icon: 'settings',
          pageTitle: 'Configurações',
          description: 'Dados gerais e meta da viagem ativa.',
          requiresTrip: true,
        },
      ],
    },
  ],
  traveler: [
    {
      label: 'Minha viagem',
      items: [
        {
          label: 'Início',
          path: '/viajante',
          icon: 'home',
          pageTitle: 'Área do viajante',
          description: 'Passagem digital e informações da viagem ativa.',
          requiresTrip: true,
        },
        {
          label: 'Pagamento',
          path: '/viajante/pagamento',
          icon: 'creditCard',
          pageTitle: 'Meu pagamento',
          description: 'Parcelamento e comprovantes da viagem ativa.',
          requiresTrip: true,
        },
      ],
    },
  ],
}

export function getNavigationItems(role: UserRole) {
  return navigationByRole[role].flatMap((section) => section.items)
}

export function getNavigationItem(role: UserRole, pathname: string) {
  return getNavigationItems(role).find((item) => item.path === pathname)
}

export function getRoleHomePath(role: UserRole) {
  return role === 'admin' ? '/admin' : '/viajante'
}
