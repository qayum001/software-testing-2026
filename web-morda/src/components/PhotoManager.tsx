import { ImagePreview } from './ImagePreview'

export interface PendingPhotoFile {
  id: string
  file: File
  previewUrl: string
}

interface PhotoManagerProps {
  photos: string[]
  newPhotoPath: string
  photoFiles: PendingPhotoFile[]
  backendBaseUrl: string
  maxPhotos: number
  onNewPhotoPathChange: (value: string) => void
  onAddPhotoPath: () => void
  onRemovePhotoPath: (index: number) => void
  onAddPhotoFiles: (files: FileList | null) => void
  onRemovePhotoFile: (id: string) => void
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} Б`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}

export function PhotoManager({
  photos,
  newPhotoPath,
  photoFiles,
  backendBaseUrl,
  maxPhotos,
  onNewPhotoPathChange,
  onAddPhotoPath,
  onRemovePhotoPath,
  onAddPhotoFiles,
  onRemovePhotoFile,
}: PhotoManagerProps) {
  const totalPhotos = photos.length + photoFiles.length
  const remainingSlots = Math.max(maxPhotos - totalPhotos, 0)
  const canAddMore = remainingSlots > 0

  return (
    <div className="form-field form-field--full">
      <div className="photo-manager__header">
        <label htmlFor="photo-path-input">Фотографии</label>
        <span className="photo-counter">
          {totalPhotos} / {maxPhotos}
        </span>
      </div>

      <div className="photo-toolbar">
        <input
          id="photo-path-input"
          value={newPhotoPath}
          onChange={(event) => onNewPhotoPathChange(event.target.value)}
          placeholder="/seed/products/oats.jpg или https://example.com/image.jpg"
          disabled={!canAddMore}
        />
        <button
          type="button"
          className="button button-secondary"
          onClick={onAddPhotoPath}
          disabled={!canAddMore}
        >
          Добавить путь
        </button>
        <label className={canAddMore ? 'upload-button' : 'upload-button is-disabled'}>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={!canAddMore}
            onChange={(event) => {
              onAddPhotoFiles(event.target.files)
              event.target.value = ''
            }}
          />
          Добавить файлы
        </label>
      </div>

      <p className="field-hint">
        Можно хранить существующие пути и добавлять новые изображения файлами. Всего доступно не
        более {maxPhotos} изображений.
      </p>

      {photos.length > 0 ? (
        <div className="photo-section">
          <strong className="section-label">Текущие фотографии</strong>
          <div className="photo-grid">
            {photos.map((photoPath, index) => (
              <div key={`${photoPath}-${index}`} className="photo-card">
                <ImagePreview
                  path={photoPath}
                  alt={`Фотография ${index + 1}`}
                  backendBaseUrl={backendBaseUrl}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => onRemovePhotoPath(index)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {photoFiles.length > 0 ? (
        <div className="photo-section">
          <strong className="section-label">Новые файлы</strong>
          <div className="photo-grid">
            {photoFiles.map((photoFile) => (
              <div key={photoFile.id} className="photo-card">
                <ImagePreview
                  path={photoFile.file.name}
                  alt={photoFile.file.name}
                  backendBaseUrl={backendBaseUrl}
                  srcOverride={photoFile.previewUrl}
                  captionOverride={photoFile.file.name}
                />
                <div className="upload-meta">
                  <span>{formatFileSize(photoFile.file.size)}</span>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => onRemovePhotoFile(photoFile.id)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {totalPhotos === 0 ? (
        <div className="empty-state empty-state--inline">
          Добавьте путь к фото или выберите файл изображения.
        </div>
      ) : null}
    </div>
  )
}
