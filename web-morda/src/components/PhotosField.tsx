import { ImagePreview } from './ImagePreview'
import { textToPhotos } from '../utils/photos'

interface PhotosFieldProps {
  value: string
  onChange: (value: string) => void
  backendBaseUrl: string
}

export function PhotosField({
  value,
  onChange,
  backendBaseUrl,
}: PhotosFieldProps) {
  const photos = textToPhotos(value)

  return (
    <div className="form-field form-field--full">
      <label htmlFor="photos">Photos</label>
      <textarea
        id="photos"
        name="photos"
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="/seed/products/oats.jpg&#10;https://example.com/image.jpg"
      />
      <p className="field-hint">
        Один путь на строку. Клиент отправляет в API массив строк и не
        использует `File`, `Blob`, `FormData` или `multipart/form-data`.
      </p>
      <div className="photo-grid">
        {photos.length > 0 ? (
          photos.map((photoPath, index) => (
            <ImagePreview
              key={`${photoPath}-${index}`}
              path={photoPath}
              alt={`Фото ${index + 1}`}
              backendBaseUrl={backendBaseUrl}
            />
          ))
        ) : (
          <div className="empty-state empty-state--inline">
            Добавьте строковые пути к изображениям, чтобы увидеть превью.
          </div>
        )}
      </div>
    </div>
  )
}
