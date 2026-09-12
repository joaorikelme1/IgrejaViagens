const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumInputBytes = 10 * 1024 * 1024
const maximumOutputCharacters = 800_000
const avatarSize = 512

export function validateProfilePhotoFile(file: File) {
  if (!supportedImageTypes.has(file.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WEBP.')
  }
  if (file.size > maximumInputBytes) {
    throw new Error('A imagem original deve ter no máximo 10 MB.')
  }
}

export function safeProfilePhoto(value: string | null | undefined) {
  return typeof value === 'string' &&
    /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)
    ? value
    : ''
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'))
    image.src = url
  })
}

export async function prepareProfilePhoto(file: File) {
  validateProfilePhotoFile(file)
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    if (sourceSize <= 0) throw new Error('A imagem selecionada está vazia.')
    const sourceX = (image.naturalWidth - sourceSize) / 2
    const sourceY = (image.naturalHeight - sourceSize) / 2
    const canvas = document.createElement('canvas')
    canvas.width = avatarSize
    canvas.height = avatarSize
    const context = canvas.getContext('2d')
    if (!context) throw new Error('O navegador não conseguiu preparar a foto.')
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      avatarSize,
      avatarSize,
    )
    const result = canvas.toDataURL('image/jpeg', 0.84)
    if (result.length > maximumOutputCharacters) {
      throw new Error('A foto ficou muito grande. Escolha outra imagem.')
    }
    return result
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
