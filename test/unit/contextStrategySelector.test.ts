import {describe, expect, it} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {ContextStrategySelector} from
  '../../src/components/ContextStrategySelector'

describe('context strategy selector options', () => {
  it('exposes only the five implemented strategies with consistent values', () => {
    const markup = renderToStaticMarkup(createElement(
      ContextStrategySelector,
      {
        value: 'bm25_recency',
        disabled: false,
        onChange: () => undefined,
      },
    ))

    expect(markup).toContain('value="baseline"')
    expect(markup).toContain('Baseline — Latest 20 Messages')
    expect(markup).toContain('value="bm25"')
    expect(markup).toContain('Method A — BM25')
    expect(markup).toContain('value="bm25_recency" selected=""')
    expect(markup).toContain('Method B — BM25 + Recency')
    expect(markup).toContain('value="bm25_recency_mmr"')
    expect(markup).toContain('Method C — BM25 + Recency + MMR')
    expect(markup).toContain('value="bm25_mmr"')
    expect(markup).toContain('Method D — BM25 + MMR')
    expect(markup).not.toContain('PRF')
  })
})
