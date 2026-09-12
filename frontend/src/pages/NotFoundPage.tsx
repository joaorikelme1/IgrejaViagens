import { Link } from 'react-router'
import { useAuth } from '../features/auth/hooks/useAuth'
import { getRoleHomePath } from '../features/navigation/config/navigation'
import './pages.css'

export function NotFoundPage() {
  const { user } = useAuth()
  const returnPath = user ? getRoleHomePath(user.role) : '/'

  return (
    <main className="not-found-page">
      <section>
        <span>404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço informado não existe nesta aplicação.</p>
        <Link to={returnPath}>
          {user ? 'Voltar para o início' : 'Voltar para o login'}
        </Link>
      </section>
    </main>
  )
}
