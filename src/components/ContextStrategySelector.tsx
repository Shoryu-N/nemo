import type { ContextSelectionStrategy } from '../types/chat'

type ContextStrategySelectorProps = {
  value: ContextSelectionStrategy
  disabled: boolean
  onChange: (strategy: ContextSelectionStrategy) => void
}

const strategyOptions: Array<{
  value: ContextSelectionStrategy
  label: string
}> = [
  { value: 'baseline', label: 'Baseline — Latest 20 Messages' },
  { value: 'bm25', label: 'Method A — BM25' },
  { value: 'bm25_recency', label: 'Method B — BM25 + Recency' },
  {
    value: 'bm25_recency_mmr',
    label: 'Method C — BM25 + Recency + MMR',
  },
  { value: 'bm25_mmr', label: 'Method D — BM25 + MMR' },
]

export function ContextStrategySelector({
  value,
  disabled,
  onChange,
}: ContextStrategySelectorProps) {
  return (
    <label className="strategy-selector">
      <span>Context strategy</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value as ContextSelectionStrategy)
        }}
      >
        {strategyOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
