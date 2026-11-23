import { NavLink } from 'react-router'
import { useLogout } from '../../auth/hooks/useLogout'
import type { AuthUser, UserRole } from '../../auth/model/authTypes'
import { ProfileAvatar } from '../../auth/components/ProfileAvatar'
import { AppIcon } from '../../../shared/components/AppIcon'
import { navigationByRole } from '../config/navigation'

interface SidebarProps {
  isOpen: boolean
  onNavigate: () => void
  onOpenProfile: () => void
  role: UserRole
  user: AuthUser
}

export function Sidebar({ isOpen, onNavigate, onOpenProfile, role, user }: SidebarProps) {
  const logout = useLogout()

  return (
    <aside
      aria-label="Navegação principal"
      className={`app-sidebar ${isOpen ? 'is-open' : ''}`}
      id="app-sidebar"
    >
      <div className="sidebar-brand">
        <img src="/imagens/logo.png" alt="Igreja Viagens" />
        <div>
          <strong>Igreja Viagens</strong>
          <span>{role === 'admin' ? 'Painel Admin' : 'Área do Viajante'}</span>
        </div>
      </div>

      <nav className="sidebar-navigation">
        {navigationByRole[role].map((section) => (
          <div className="sidebar-section" key={section.label}>
            <p>{section.label}</p>
            {section.items.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'is-active' : ''}`
                }
                end={item.path === '/admin' || item.path === '/viajante'}
                key={item.path}
                onClick={onNavigate}
                to={item.path}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <div className="sidebar-user">
          <ProfileAvatar
            className="sidebar-avatar"
            name={user.name}
            onClick={onOpenProfile}
            profilePhoto={user.profilePhoto}
          />
          <div>
            <strong>{user.name}</strong>
            <span>{role === 'admin' ? 'Administrador' : 'Viajante'}</span>
          </div>
        </div>
        <button
          aria-label="Sair"
          onClick={() => {
            void logout()
          }}
          type="button"
        >
          <AppIcon name="logout" />
        </button>
      </footer>
    </aside>
  )
}
