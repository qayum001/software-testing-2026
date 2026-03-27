import type { ProblemDetails } from '../types/api'

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const messageTranslations: Record<string, string> = {
  'api error': 'Ошибка API',
  'failed to perform request.': 'Не удалось выполнить запрос.',
  'dish category is required when name has no category macro.':
    'Категория блюда обязательна, если в названии нет макроса категории.',
  'photos count cannot be greater than 5.': 'Количество фотографий не может быть больше 5.',
  'portion size must be a finite number.': 'Размер порции должен быть конечным числом.',
  'portion size must be greater than 0.': 'Размер порции должен быть больше 0.',
  'dish must contain at least 1 product.': 'Блюдо должно содержать хотя бы один продукт.',
  'each product amount must be a finite number greater than 0 grams.':
    'Количество каждого продукта должно быть конечным числом больше 0 граммов.',
  'the sum of proteins, fats, and carbs per 100 g cannot exceed 100.':
    'Сумма белков, жиров и углеводов на 100 г блюда не может превышать 100.',
  'calories must be a finite number.': 'Калории должны быть конечным числом.',
  'calories cannot be negative.': 'Калории не могут быть отрицательными.',
  'proteins must be a finite number.': 'Белки должны быть конечным числом.',
  'proteins cannot be negative.': 'Белки не могут быть отрицательными.',
  'proteins cannot exceed 100 per portion.': 'Белки не могут превышать 100 на порцию.',
  'fats must be a finite number.': 'Жиры должны быть конечным числом.',
  'fats cannot be negative.': 'Жиры не могут быть отрицательными.',
  'fats cannot exceed 100 per portion.': 'Жиры не могут превышать 100 на порцию.',
  'carbs must be a finite number.': 'Углеводы должны быть конечным числом.',
  'carbs cannot be negative.': 'Углеводы не могут быть отрицательными.',
  'carbs cannot exceed 100 per portion.': 'Углеводы не могут превышать 100 на порцию.',
}

function translateMessage(message: string) {
  return messageTranslations[message.toLowerCase()] ?? message
}

export function getProblemTitle(problem?: ProblemDetails | null) {
  if (!problem?.title) {
    return null
  }

  return translateMessage(problem.title)
}

export function getProblemMessage(problem?: ProblemDetails | null) {
  if (!problem) {
    return null
  }

  return translateMessage(problem.detail || problem.title || 'Не удалось выполнить запрос.')
}

export function getValidationErrors(problem?: ProblemDetails | null) {
  const candidate = problem?.errors
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {} as Record<string, string[]>
  }

  const result: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      continue
    }

    result[normalizeKey(key)] = value.map((item) => translateMessage(String(item)))
  }

  return result
}

export function getFieldErrors(
  validationErrors: Record<string, string[]>,
  fieldName: string,
) {
  return validationErrors[normalizeKey(fieldName)] ?? []
}

function extractNamesFromArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: string[] = []

  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      result.push(entry.trim())
      continue
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const objectEntry = entry as Record<string, unknown>
    const namedValue = objectEntry.name ?? objectEntry.dishName ?? objectEntry.title ?? objectEntry.value

    if (typeof namedValue === 'string' && namedValue.trim()) {
      result.push(namedValue.trim())
    }
  }

  return result
}

export function extractRelatedDishNames(problem?: ProblemDetails | null) {
  if (!problem) {
    return []
  }

  const result = new Set<string>()
  const ignoredKeys = new Set(['type', 'title', 'status', 'detail', 'instance', 'errors'])

  for (const [key, value] of Object.entries(problem)) {
    if (ignoredKeys.has(key)) {
      continue
    }

    for (const name of extractNamesFromArray(value)) {
      result.add(name)
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue
    }

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      for (const name of extractNamesFromArray(nestedValue)) {
        result.add(name)
      }
    }
  }

  return [...result]
}

export function toFallbackProblem(status: number, message: string) {
  return {
    status,
    title: 'Ошибка API',
    detail: translateMessage(message),
  } satisfies ProblemDetails
}
