interface DonutSlice {
  color: string
  label: string
  value: number
}

interface DonutChartProps {
  accessibleLabel: string
  slices: DonutSlice[]
}

export function DonutChart({ accessibleLabel, slices }: DonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let consumed = 0

  return (
    <div className="donut-chart">
      <svg aria-label={accessibleLabel} role="img" viewBox="0 0 120 120">
        <circle className="donut-chart__track" cx="60" cy="60" r="43" />
        {total > 0
          ? slices.map((slice) => {
              const size = (slice.value / total) * 100
              const offset = -consumed
              consumed += size
              return (
                <circle
                  className="donut-chart__slice"
                  cx="60"
                  cy="60"
                  key={slice.label}
                  r="43"
                  stroke={slice.color}
                  strokeDasharray={`${size} ${100 - size}`}
                  strokeDashoffset={offset}
                  pathLength="100"
                />
              )
            })
          : null}
        <text x="60" y="57">
          {total || '—'}
        </text>
        <text className="donut-chart__caption" x="60" y="70">
          {total ? 'total' : 'sem dados'}
        </text>
      </svg>
      <ul>
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ backgroundColor: slice.color }} />
            <span>{slice.label}</span>
            <strong>{slice.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
