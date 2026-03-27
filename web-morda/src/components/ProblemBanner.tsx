import type { ProblemDetails } from '../types/api'
import {
  extractRelatedDishNames,
  getProblemMessage,
  getProblemTitle,
} from '../utils/problemDetails'

interface ProblemBannerProps {
  problem?: ProblemDetails | null
  relatedDishNames?: string[]
}

export function ProblemBanner({ problem, relatedDishNames }: ProblemBannerProps) {
  const title = getProblemTitle(problem)
  const message = getProblemMessage(problem)
  const dishes =
    relatedDishNames && relatedDishNames.length > 0
      ? relatedDishNames
      : extractRelatedDishNames(problem)

  if (!title && !message && dishes.length === 0) {
    return null
  }

  return (
    <div className="problem-banner" role="alert">
      {title ? <strong>{title}</strong> : null}
      {message ? <p>{message}</p> : null}
      {problem?.status ? <span className="problem-status">HTTP {problem.status}</span> : null}
      {dishes.length > 0 ? (
        <div className="problem-related">
          <span>Связанные блюда:</span>
          <ul>
            {dishes.map((dishName) => (
              <li key={dishName}>{dishName}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
