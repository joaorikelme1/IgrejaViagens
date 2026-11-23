import { useState } from 'react'
import { safeProfilePhoto } from '../utils/profilePhoto'
import './profilePhoto.css'

interface ProfileAvatarProps {
  className: string
  name: string
  onClick: () => void
  profilePhoto?: string
}

export function ProfileAvatar({
  className,
  name,
  onClick,
  profilePhoto,
}: ProfileAvatarProps) {
  const safePhoto = safeProfilePhoto(profilePhoto)
  const [failedPhoto, setFailedPhoto] = useState('')

  return (
    <button
      aria-label="Alterar foto de perfil"
      className={`profile-avatar ${className}`}
      onClick={onClick}
      title="Alterar foto de perfil"
      type="button"
    >
      {safePhoto && failedPhoto !== safePhoto ? (
        <img
          alt=""
          onError={() => setFailedPhoto(safePhoto)}
          src={safePhoto}
        />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
      )}
    </button>
  )
}
