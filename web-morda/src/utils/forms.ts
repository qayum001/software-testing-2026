export function cleanNullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function parseRequiredNumber(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return {
      value: null,
      error: `${label}: укажите число.`,
    }
  }

  const parsed = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(parsed)) {
    return {
      value: null,
      error: `${label}: введите корректное число.`,
    }
  }

  return {
    value: parsed,
    error: null,
  }
}

export function parseOptionalNumber(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return {
      value: null,
      error: null,
    }
  }

  const parsed = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(parsed)) {
    return {
      value: null,
      error: `${label}: введите корректное число.`,
    }
  }

  return {
    value: parsed,
    error: null,
  }
}

export function parseNumericSelection<T extends number>(value: string) {
  if (!value) {
    return undefined
  }

  return Number(value) as T
}

export function toggleNumericValue(values: number[], nextValue: number, checked: boolean) {
  if (checked) {
    return values.includes(nextValue) ? values : [...values, nextValue]
  }

  return values.filter((value) => value !== nextValue)
}
