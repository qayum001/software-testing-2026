import { useState } from 'react'
import { isWindowsPath, resolvePhotoUrl } from '../utils/photos'

interface ImagePreviewProps {
  path: string
  alt: string
  backendBaseUrl: string
  compact?: boolean
  srcOverride?: string
  captionOverride?: string
}

export function ImagePreview({
  path,
  alt,
  backendBaseUrl,
  compact = false,
  srcOverride,
  captionOverride,
}: ImagePreviewProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const trimmedPath = path.trim()
  const src = srcOverride ?? resolvePhotoUrl(trimmedPath, backendBaseUrl)
  const failed = Boolean(src) && failedSrc === src

  const className = compact
    ? 'image-preview image-preview--compact'
    : 'image-preview image-preview--full'

  if (!trimmedPath) {
    return (
      <div className={`${className} image-preview--fallback`}>
        <span>Нет изображения</span>
      </div>
    )
  }

  if (!src || failed) {
    const hint = isWindowsPath(trimmedPath)
      ? 'Локальные пути Windows не отображаются в браузере.'
      : 'Поддерживаются только абсолютные URL http(s) или пути сервера вида /seed/...'

    return (
      <div className={`${className} image-preview--fallback`}>
        <span>{trimmedPath}</span>
        <small>{hint}</small>
      </div>
    )
  }

  return (
    <>
      <figure className={className}>
        <button
          type="button"
          className="image-preview__button"
          onClick={() => setIsOpen(true)}
        >
          <img src={src} alt={alt} onError={() => setFailedSrc(src)} />
        </button>
        {!compact ? <figcaption>{captionOverride ?? trimmedPath}</figcaption> : null}
      </figure>

      {isOpen ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setIsOpen(false)}
        >
          <div className="lightbox__content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox__close"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </button>
            <img className="lightbox__image" src={src} alt={alt} />
            <p className="lightbox__caption">{captionOverride ?? trimmedPath}</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
