import type { AiAnalysisResult } from '../types/chat'

type AiPanelProps = {
  analysis: AiAnalysisResult | null
  isAnalyzing: boolean
  error: string | null
  onAnalyze: () => void
  onUseReply: () => void
}

export function AiPanel({
  analysis,
  isAnalyzing,
  error,
  onAnalyze,
  onUseReply,
}: AiPanelProps) {
  const hasSuggestion = Boolean(analysis?.suggestedReply)

  return (
    <aside className="panel ai-panel" aria-labelledby="ai-panel-title">
      <div className="section-header">
        <div>
          <h2 id="ai-panel-title">AI Analysis</h2>
          <p className="section-note">Review AI output before using any reply.</p>
        </div>
        <button type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analyzing...' : 'Analyze Conversation'}
        </button>
      </div>

      {error && <p className="state-message error-message">{error}</p>}
      {isAnalyzing && (
        <p className="state-message">Conversation analysis is in progress...</p>
      )}
      {!analysis && !isAnalyzing && !error && (
        <p className="state-message">No analysis has been requested yet.</p>
      )}

      <section className="ai-section" aria-labelledby="summary-title">
        <h3 id="summary-title">Summary</h3>
        <p>{analysis?.summary ?? 'Run analysis to generate a summary.'}</p>
      </section>

      <section className="ai-section" aria-labelledby="important-info-title">
        <h3 id="important-info-title">Important Information</h3>
        {analysis && analysis.importantInformation.length > 0 ? (
          <ul>
            {analysis.importantInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No important information identified.</p>
        )}
      </section>

      <section className="ai-section" aria-labelledby="suggested-reply-title">
        <h3 id="suggested-reply-title">Suggested Reply</h3>
        <p>{analysis?.suggestedReply ?? 'Run analysis to generate a reply.'}</p>
        <button
          type="button"
          className="secondary-button"
          disabled={!hasSuggestion}
          onClick={onUseReply}
        >
          Use Reply
        </button>
      </section>
    </aside>
  )
}
