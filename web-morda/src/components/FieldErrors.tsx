interface FieldErrorsProps {
  errors: string[]
}

export function FieldErrors({ errors }: FieldErrorsProps) {
  if (errors.length === 0) {
    return null
  }

  return (
    <div className="field-errors" role="alert">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  )
}
