import type { ReactNode } from 'react'

interface StatCardProps {
  detail: string
  label: string
  value: ReactNode
}

export function StatCard({ detail, label, value }: StatCardProps) {
  return (
    <article className="dashboard-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
