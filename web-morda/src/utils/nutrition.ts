interface MacroValues {
  proteins: number | null
  fats: number | null
  carbs: number | null
}

export function validateMacroValues(values: MacroValues) {
  const errors: Record<string, string[]> = {}

  if (values.proteins !== null && values.proteins > 100) {
    errors.proteins = ['Белки не должны быть больше 100.']
  }

  if (values.fats !== null && values.fats > 100) {
    errors.fats = ['Жиры не должны быть больше 100.']
  }

  if (values.carbs !== null && values.carbs > 100) {
    errors.carbs = ['Углеводы не должны быть больше 100.']
  }

  const total = (values.proteins ?? 0) + (values.fats ?? 0) + (values.carbs ?? 0)
  if (total > 100) {
    errors.macros = ['Сумма белков, жиров и углеводов не должна превышать 100.']
  }

  return errors
}

export function validateDishMacroValues(values: MacroValues, portionSize: number | null) {
  const errors: Record<string, string[]> = {}

  if (values.proteins !== null && values.proteins > 100) {
    errors.proteins = ['Белки не должны быть больше 100 на порцию.']
  }

  if (values.fats !== null && values.fats > 100) {
    errors.fats = ['Жиры не должны быть больше 100 на порцию.']
  }

  if (values.carbs !== null && values.carbs > 100) {
    errors.carbs = ['Углеводы не должны быть больше 100 на порцию.']
  }

  if (portionSize !== null && Number.isFinite(portionSize) && portionSize > 0) {
    const total = (values.proteins ?? 0) + (values.fats ?? 0) + (values.carbs ?? 0)
    if ((total / portionSize) * 100 > 100) {
      errors.macros = ['Сумма белков, жиров и углеводов на 100 г блюда не должна превышать 100.']
    }
  }

  return errors
}
