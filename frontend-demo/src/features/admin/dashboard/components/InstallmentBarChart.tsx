interface InstallmentBarChartProps {
  rows: Array<{ name: string; paid: number; total: number }>
}

export function InstallmentBarChart({ rows }: InstallmentBarChartProps) {
  if (rows.length === 0) {
    return <p className="dashboard-empty-chart">Sem viajantes para exibir.</p>
  }

  return (
    <div
      aria-label="Parcelas pagas por viajante"
      className="installment-chart"
      role="img"
    >
      {rows.map((row, index) => {
        const percentage = row.total > 0 ? (row.paid / row.total) * 100 : 0
        return (
          <div className="installment-chart__row" key={`${row.name}-${index}`}>
            <span>{row.name}</span>
            <div>
              <i style={{ width: `${Math.min(100, percentage)}%` }} />
            </div>
            <strong>
              {row.paid}/{row.total}
            </strong>
          </div>
        )
      })}
    </div>
  )
}
