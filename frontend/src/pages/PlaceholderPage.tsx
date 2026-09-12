import type { AppIconName } from '../shared/components/AppIcon'
import { AppIcon } from '../shared/components/AppIcon'
import { useTrip } from '../features/trips/hooks/useTrip'
import './pages.css'

interface PlaceholderPageProps {
  description: string
  icon: AppIconName
  title: string
}

export function PlaceholderPage({
  description,
  icon,
  title,
}: PlaceholderPageProps) {
  const { activeTrip } = useTrip()

  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <span className="placeholder-page__icon">
        <AppIcon name={icon} />
      </span>
      <p className="placeholder-page__eyebrow">Estrutura de navegação</p>
      <h2 id="placeholder-title">{title}</h2>
      <p>{description}</p>
      {activeTrip ? (
        <div className="placeholder-page__trip">
          <AppIcon name="plane" />
          Contexto ativo: <strong>{activeTrip.name}</strong>
        </div>
      ) : null}
    </section>
  )
}
