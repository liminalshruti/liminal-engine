/**
 * GeminiVisibility — surface agent/model/artifacts used in agent output.
 * Renders the Gemini agent's role, model, and the artifacts it processed.
 */
import type { AgentMetadata } from "@liminal-engine/contracts";

export interface GeminiVisibilityProps {
  agentMetadata?: AgentMetadata;
}

export function GeminiVisibility({ agentMetadata }: GeminiVisibilityProps) {
  if (!agentMetadata) {
    return null;
  }

  return (
    <div className="gemini-visibility">
      <div className="gemini-visibility__header">
        <span className="gemini-visibility__badge">{agentMetadata.agent}</span>
        <span className="gemini-visibility__model">{agentMetadata.model}</span>
      </div>
      {agentMetadata.artifacts && agentMetadata.artifacts.length > 0 && (
        <div className="gemini-visibility__artifacts">
          <span className="gemini-visibility__label">Artifacts processed:</span>
          <ul className="gemini-visibility__list">
            {agentMetadata.artifacts.map((artifact) => (
              <li key={artifact} className="gemini-visibility__item">
                {artifact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default GeminiVisibility;
