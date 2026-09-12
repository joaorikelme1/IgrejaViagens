import { useEffect, useMemo, useState } from 'react'
import { stripCpf } from '../../../shared/validation/cpf'
import { useTrip } from '../../trips/hooks/useTrip'
import type { Trip } from '../../trips/model/tripTypes'
import {
  addExistingUserToTrip,
  createTravelerForTrip,
  removeTravelerFromTrip,
} from '../api/travelerCompatibilityApi'
import { loadTripTravelerSource } from '../api/tripTravelerApi'
import { updateUser } from '../api/usersApi'
import { AddTravelerToTripModal } from '../components/AddTravelerToTripModal'
import { ConfirmUserActionModal } from '../components/ConfirmUserActionModal'
import { TravelerDetailsModal } from '../components/TravelerDetailsModal'
import { TravelerTable } from '../components/TravelerTable'
import { UserForm } from '../components/UserForm'
import {
  buildTripTravelers,
  type TripTravelerRow,
} from '../lib/buildTripTravelers'
import { filterUsers } from '../lib/userSearch'
import type {
  SystemUser,
  TripTravelerSource,
  UserMutation,
} from '../model/userTypes'
import './userManagement.css'

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os viajantes.'
}

function TripTravelersContent({ trip }: { trip: Trip }) {
  const { reloadTrips } = useTrip()
  const [source, setSource] = useState<TripTravelerSource | null>(null)
  const [memberCpfs, setMemberCpfs] = useState(() => [...trip.travelerCpfs])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [formState, setFormState] = useState<
    { mode: 'create' } | { mode: 'edit'; user: SystemUser } | null
  >(null)
  const [showExisting, setShowExisting] = useState(false)
  const [details, setDetails] = useState<TripTravelerRow | null>(null)
  const [removing, setRemoving] = useState<TripTravelerRow | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const reloadSource = async () => {
    const loaded = await loadTripTravelerSource(trip.id)
    setSource(loaded)
    return loaded
  }

  useEffect(() => {
    let current = true
    void loadTripTravelerSource(trip.id)
      .then((loaded) => {
        if (current) setSource(loaded)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(messageFrom(error))
      })
    return () => {
      current = false
    }
  }, [trip.id])

  const rows = useMemo(
    () => (source ? buildTripTravelers(memberCpfs, source) : []),
    [memberCpfs, source],
  )
  const filteredRows = useMemo(() => {
    const visible = new Set(filterUsers(rows.map((row) => row.user), query).map((user) => user.cpf))
    return rows.filter((row) => visible.has(row.user.cpf))
  }, [query, rows])
  const normalizedMembers = new Set(memberCpfs.map(stripCpf))
  const capacityReached = normalizedMembers.size >= trip.maxPeople
  const availableUsers = (source?.users ?? []).filter(
    (user) => user.role === 'traveler' && !normalizedMembers.has(user.cpf),
  )

  const addExisting = async (cpf: string) => {
    setFeedback(null)
    await addExistingUserToTrip(cpf, trip.id)
    setMemberCpfs((current) => [...new Set([...current, stripCpf(cpf)])])
    await reloadSource()
    reloadTrips()
    setFeedback('Usuário adicionado à viagem e pagamento inicial criado.')
  }

  const saveForm = async (cpf: string, mutation: UserMutation) => {
    setFeedback(null)
    if (formState?.mode === 'edit') {
      const updated = await updateUser(cpf, {
        ...mutation,
        role: formState.user.role,
      })
      setSource((current) =>
        current
          ? {
              ...current,
              users: current.users.map((user) =>
                user.cpf === cpf ? updated : user,
              ),
            }
          : current,
      )
      setFeedback('Viajante atualizado com sucesso.')
      return
    }

    if (capacityReached) {
      throw new Error(
        `A viagem atingiu o limite de ${trip.maxPeople} ${trip.maxPeople === 1 ? 'pessoa' : 'pessoas'}.`,
      )
    }
    if (source?.users.some((user) => user.cpf === stripCpf(cpf))) {
      throw new Error(
        'Este CPF já existe no cadastro global. Use “Adicionar existente”.',
      )
    }

    const created = await createTravelerForTrip(cpf, mutation, trip.id)
    setMemberCpfs((current) => [...new Set([...current, created.cpf])])
    await reloadSource()
    reloadTrips()
    setFeedback('Novo viajante cadastrado, associado e com pagamento inicial.')
  }

  const removeFromTrip = async () => {
    if (!removing) return
    const cpf = removing.user.cpf
    setFeedback(null)
    await removeTravelerFromTrip(cpf, trip.id)
    setMemberCpfs((current) => current.filter((item) => stripCpf(item) !== cpf))
    await reloadSource()
    reloadTrips()
    setFeedback('Viajante removido somente desta viagem.')
  }

  if (loadError) return <p className="user-page-status" role="alert">{loadError}</p>
  if (!source) return <p className="user-page-status" role="status">Carregando viajantes...</p>

  return (
    <div className="user-management-page">
      <header className="user-page-intro">
        <div><span>Viagem ativa</span><h2>Viajantes de {trip.name}</h2><p>{normalizedMembers.size} de {trip.maxPeople} vaga(s) ocupada(s).</p></div>
        <div className="user-page-actions">
          <button disabled={capacityReached} onClick={() => setShowExisting(true)} type="button">Adicionar existente</button>
          <button className="user-primary-action" disabled={capacityReached} onClick={() => setFormState({ mode: 'create' })} type="button">Novo viajante</button>
        </div>
      </header>

      <aside className="user-info-banner">
        Remover nesta página mantém o cadastro global. A exclusão definitiva é
        uma ação separada, disponível somente em Cadastro Global.
      </aside>
      {capacityReached ? <p className="form-message is-error" role="alert">A viagem atingiu o limite de {trip.maxPeople} {trip.maxPeople === 1 ? 'pessoa' : 'pessoas'}.</p> : null}
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}

      <section className="user-panel">
        <header className="user-panel__header">
          <div><h3>Viajantes associados</h3><small>Dados operacionais da viagem</small></div>
          <label className="user-search"><span>Buscar por nome ou CPF</span><input onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Nome ou CPF" value={query} /></label>
        </header>
        <TravelerTable
          onEdit={(row) => setFormState({ mode: 'edit', user: row.user })}
          onRemove={setRemoving}
          onView={setDetails}
          rows={filteredRows}
        />
      </section>

      {showExisting ? (
        <AddTravelerToTripModal
          capacityReached={capacityReached}
          onAdd={addExisting}
          onClose={() => setShowExisting(false)}
          users={availableUsers}
        />
      ) : null}
      {formState ? (
        <UserForm
          fixedRole="traveler"
          forceFirstLoginOnCreate
          onClose={() => setFormState(null)}
          onSubmit={saveForm}
          title={formState.mode === 'edit' ? 'Editar viajante' : 'Cadastrar novo viajante'}
          user={formState.mode === 'edit' ? formState.user : undefined}
        />
      ) : null}
      {details ? <TravelerDetailsModal onClose={() => setDetails(null)} row={details} /> : null}
      {removing ? (
        <ConfirmUserActionModal
          confirmLabel="Remover somente da viagem"
          description={`${removing.user.name} será removido desta viagem, inclusive de pagamento, assento e quarto relacionados. O cadastro global será mantido.`}
          onCancel={() => setRemoving(null)}
          onConfirm={removeFromTrip}
          title="Remover viajante da viagem?"
        />
      ) : null}
    </div>
  )
}

export function TripTravelersPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <TripTravelersContent key={activeTrip.id} trip={activeTrip} />
}
