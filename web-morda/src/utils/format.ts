export function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

export function formatList(values?: Array<string | number> | null) {
  if (!values || values.length === 0) {
    return '—'
  }

  return values.map((value) => String(value)).join(', ')
}

export function shortId(value?: string | null) {
  if (!value) {
    return '—'
  }

  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}
