import type { AiAnalysisResult } from '../types/chat'

type AiPanelProps = {
  analysis: AiAnalysisResult
  onAnalyze: () => void
  onUseReply: () => void
}

export function AiPanel({ analysis, onAnalyze, onUseReply }: AiPanelProps) {
  return (
    <aside className="panel ai-panel" aria-labelledby="ai-panel-title">
      <div className="section-header">
        <div>
          <h2 id="ai-panel-title">AI Analysis</h2>
          <p className="section-note">Placeholder output until the callable function is added.</p>
        </div>
        <button type="button" onClick={onAnalyze}>
          Analyze Conversation
        </button>
      </div>

      <section className="ai-section" aria-labelledby="summary-title">
        <h3 id="summary-title">Summary</h3>
        <p>{analysis.summary}</p>
      </section>

      <section className="ai-section" aria-labelledby="important-info-title">
        <h3 id="important-info-title">Important Information</h3>
        <ul>
          {analysis.importantInformation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="ai-section" aria-labelledby="suggested-reply-title">
        <h3 id="suggested-reply-title">Suggested Reply</h3>
        <p>{analysis.suggestedReply}</p>
        <button type="button" className="secondary-button" onClick={onUseReply}>
          Use Reply
        </button>
      </section>
    </aside>
  )
}
