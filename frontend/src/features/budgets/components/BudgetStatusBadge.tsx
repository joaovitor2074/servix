import {
  STATUS_ORCAMENTO_LABELS,
  type StatusOrcamento,
} from '../types/budget.types'
import './BudgetStatusBadge.css'

interface BudgetStatusBadgeProps {
  status: StatusOrcamento
  dot?: boolean
}

export default function BudgetStatusBadge({
  status,
  dot = false,
}: BudgetStatusBadgeProps) {
  return (
    <span
      className={`budget-status budget-status--${status.toLowerCase()}`}
    >
      {dot && <span className="budget-status__dot" aria-hidden="true" />}
      {STATUS_ORCAMENTO_LABELS[status]}
    </span>
  )
}
