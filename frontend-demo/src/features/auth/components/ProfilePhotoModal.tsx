import { useState, type ChangeEvent } from 'react'
import { saveProfilePhoto } from '../api/authApi'
import type { AuthUser } from '../model/authTypes'
import { prepareProfilePhoto, safeProfilePhoto } from '../utils/profilePhoto'

interface ProfilePhotoModalProps {
  onClose: () => void
  onSaved: (profilePhoto: string) => void
  user: AuthUser
}

export function ProfilePhotoModal({ onClose, onSaved, user }: ProfilePhotoModalProps) {
  const [preview, setPreview] = useState(() => safeProfilePhoto(user.profilePhoto))
  const [isPreparing, setIsPreparing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setError(null)
    setIsPreparing(true)
    try {
      setPreview(await prepareProfilePhoto(file))
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Não foi possível preparar a foto.')
    } finally {
      setIsPreparing(false)
    }
  }

  const persist = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const saved = await saveProfilePhoto(user.cpf, preview)
      onSaved(saved)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a foto.')
    } finally {
      setIsSaving(false)
    }
  }

  const busy = isPreparing || isSaving

  return (
    <div className="profile-photo-overlay">
      <section
        aria-labelledby="profile-photo-title"
        aria-modal="true"
        className="profile-photo-modal"
        role="dialog"
      >
        <header>
          <div>
            <span>Minha conta</span>
            <h2 id="profile-photo-title">Foto de perfil</h2>
            <p>Escolha uma imagem para aparecer ao lado do seu nome.</p>
          </div>
          <button aria-label="Fechar" disabled={busy} onClick={onClose} type="button">×</button>
        </header>

        <div className="profile-photo-body">
          <div className="profile-photo-preview">
            {preview ? <img alt="Pré-visualização da foto de perfil" src={preview} /> : (
              <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>
          <div className="profile-photo-options">
            <strong>{user.name}</strong>
            <p>A imagem será recortada em formato quadrado e otimizada automaticamente.</p>
            <label className="profile-photo-upload">
              {isPreparing ? 'Preparando imagem...' : 'Escolher foto'}
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => void selectPhoto(event)}
                type="file"
              />
            </label>
            {preview ? (
              <button className="profile-photo-remove" disabled={busy} onClick={() => setPreview('')} type="button">
                Remover foto
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="form-message is-error profile-photo-error" role="alert">{error}</p> : null}

        <footer>
          <button disabled={busy} onClick={onClose} type="button">Cancelar</button>
          <button className="is-primary" disabled={busy} onClick={() => void persist()} type="button">
            {isSaving ? 'Salvando...' : 'Salvar foto'}
          </button>
        </footer>
      </section>
    </div>
  )
}
