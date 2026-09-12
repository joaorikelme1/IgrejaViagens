import { useEffect, useMemo, useState } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import { listTrips } from '../../trips/api/tripApi'
import { useTrip } from '../../trips/hooks/useTrip'
import type { Trip } from '../../trips/model/tripTypes'
import { deleteUserGlobally } from '../api/travelerCompatibilityApi'
import { createUser, listUsers, updateUser } from '../api/usersApi'
import { ConfirmUserActionModal } from '../components/ConfirmUserActionModal'
import { UserForm } from '../components/UserForm'
import { filterUsers } from '../lib/userSearch'
import type { SystemUser, UserMutation } from '../model/userTypes'
import './userManagement.css'

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os usuários.'
}

function GlobalUsersContent() {
  const { reloadTrips } = useTrip()
  const [users, setUsers] = useState<SystemUser[] | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingUser, setEditingUser] = useState<SystemUser | null | undefined>()
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void Promise.all([listUsers(), listTrips()])
      .then(([loadedUsers, loadedTrips]) => {
        if (!current) return
        setUsers(loadedUsers)
        setTrips(loadedTrips)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(messageFrom(error))
      })
    return () => {
      current = false
    }
  }, [])

  const filteredUsers = useMemo(
    () => filterUsers(users ?? [], query),
    [query, users],
  )

  const save = async (cpf: string, mutation: UserMutation) => {
    setFeedback(null)
    if (editingUser) {
      const updated = await updateUser(cpf, mutation)
      setUsers((current) =>
        current?.map((user) => (user.cpf === cpf ? updated : user)) ?? null,
      )
      setFeedback('Usuário atualizado com sucesso.')
      return
    }

    if (users?.some((user) => user.cpf === cpf)) {
      throw new Error('Já existe um usuário cadastrado com este CPF.')
    }
    const created = await createUser(cpf, mutation)
    setUsers((current) => (current ? [...current, created] : [created]))
    setFeedback('Usuário cadastrado com sucesso.')
  }

  const removeGlobally = async () => {
    if (!deletingUser) return
    setFeedback(null)
    const cpf = deletingUser.cpf
    await deleteUserGlobally(cpf)
    setUsers((current) => current?.filter((user) => user.cpf !== cpf) ?? null)
    setTrips((current) =>
      current.map((trip) => {
        const travelerCpfs = trip.travelerCpfs.filter((item) => item !== cpf)
        return {
          ...trip,
          travelerCpfs,
          travelersJson: JSON.stringify(travelerCpfs),
        }
      }),
    )
    reloadTrips()
    setFeedback('Usuário excluído globalmente.')
  }

  if (loadError) {
    return <p className="user-page-status" role="alert">{loadError}</p>
  }
  if (!users) {
    return <p className="user-page-status" role="status">Carregando usuários...</p>
  }

  return (
    <div className="user-management-page">
      <header className="user-page-intro">
        <div>
          <span>Cadastro global</span>
          <h2>Usuários do sistema</h2>
          <p>Cadastros independentes das associações com viagens.</p>
        </div>
        <button className="user-primary-action" onClick={() => setEditingUser(null)} type="button">
          Novo usuário
        </button>
      </header>

      <aside className="user-info-banner">
        Excluir aqui remove o usuário globalmente e limpa suas associações. Para
        retirar uma pessoa de apenas uma viagem, use a página Viajantes.
      </aside>
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}

      <section className="user-panel">
        <header className="user-panel__header">
          <div><h3>Usuários cadastrados</h3><small>{users.length} registro(s)</small></div>
          <label className="user-search">
            <span>Buscar por nome ou CPF</span>
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Nome ou CPF"
              value={query}
            />
          </label>
        </header>
        <div className="user-table-wrap">
          <table className="user-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>Papel</th><th>Primeiro acesso</th><th>Família</th><th>Viagens</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredUsers.length ? filteredUsers.map((user) => {
                const associatedTrips = trips
                  .filter((trip) => trip.travelerCpfs.includes(user.cpf))
                  .map((trip) => trip.name)
                return (
                  <tr key={user.cpf}>
                    <td><div className="user-identity"><span>{user.name.slice(0, 1).toUpperCase()}</span><strong>{user.name}</strong></div></td>
                    <td>{maskCpf(user.cpf)}</td>
                    <td><span className="user-badge">{user.role === 'admin' ? 'Administrador' : 'Viajante'}</span></td>
                    <td><span className={`user-badge ${user.firstLogin ? 'is-pending' : 'is-active'}`}>{user.firstLogin ? 'Aguardando' : 'Ativo'}</span></td>
                    <td>
                      {user.married && user.spouseName ? `Cônjuge informado: ${user.spouseName}` : 'Sem cônjuge informado'}
                      {user.hasKids && user.kids.length ? ` · ${user.kids.length} filho(s)` : ''}
                    </td>
                    <td>{associatedTrips.join(', ') || '—'}</td>
                    <td><div className="user-row-actions"><button onClick={() => setEditingUser(user)} type="button">Editar</button><button className="is-danger" onClick={() => setDeletingUser(user)} type="button">Excluir globalmente</button></div></td>
                  </tr>
                )
              }) : <tr><td className="user-empty" colSpan={7}>Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editingUser !== undefined ? (
        <UserForm
          forceFirstLoginOnCreate
          onClose={() => setEditingUser(undefined)}
          onSubmit={save}
          title={editingUser ? 'Editar usuário' : 'Novo usuário'}
          user={editingUser ?? undefined}
        />
      ) : null}
      {deletingUser ? (
        <ConfirmUserActionModal
          confirmLabel="Excluir usuário globalmente"
          description={`Esta ação excluirá ${deletingUser.name} do sistema e removerá suas associações com todas as viagens, pagamentos, assentos e quartos.`}
          onCancel={() => setDeletingUser(null)}
          onConfirm={removeGlobally}
          title="Confirmar exclusão global"
        />
      ) : null}
    </div>
  )
}

export function GlobalUsersPage() {
  return <GlobalUsersContent />
}
