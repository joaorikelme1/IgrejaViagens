import { describe, expect, it } from 'vitest'
import { safeProfilePhoto, validateProfilePhotoFile } from './profilePhoto'

describe('tratamento da foto de perfil', () => {
  it('aceita apenas formatos de imagem suportados', () => {
    expect(() => validateProfilePhotoFile(new File(['photo'], 'foto.jpg', { type: 'image/jpeg' }))).not.toThrow()
    expect(() => validateProfilePhotoFile(new File(['svg'], 'foto.svg', { type: 'image/svg+xml' }))).toThrow(
      'Escolha uma imagem JPG, PNG ou WEBP.',
    )
  })

  it('impede URLs externas e SVG no avatar', () => {
    expect(safeProfilePhoto('data:image/webp;base64,YWJj')).toBe('data:image/webp;base64,YWJj')
    expect(safeProfilePhoto('data:image/svg+xml;base64,YWJj')).toBe('')
    expect(safeProfilePhoto('https://example.com/foto.jpg')).toBe('')
  })
})
