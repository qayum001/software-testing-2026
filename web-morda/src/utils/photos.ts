export const MAX_PHOTOS = 5

export function photosToText(photos?: string[] | null) {
  return (photos ?? []).join('\n')
}

export function textToPhotos(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function isWindowsPath(value: string) {
  return /^[a-zA-Z]:\\/.test(value) || /^\\\\/.test(value)
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function resolvePhotoUrl(photoPath: string, backendBaseUrl: string) {
  const trimmed = photoPath.trim()
  if (!trimmed || isWindowsPath(trimmed)) {
    return null
  }

  if (isAbsoluteHttpUrl(trimmed)) {
    return trimmed
  }

  if (!trimmed.startsWith('/')) {
    return null
  }

  const baseUrl = backendBaseUrl.trim() || window.location.origin
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  try {
    return new URL(trimmed, normalizedBase).toString()
  } catch {
    return null
  }
}
