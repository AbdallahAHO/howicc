import { useState } from 'react';
import type { Thought } from '@howicc/schemas';

export interface ThoughtBlockProps {
  thought: Thought;
}

/**
 * Dumb component for rendering agent thoughts with distinct UI
 *
 * Design: Indented, dashed border, brain icon, muted colors
 * Collapsible to reduce visual noise
 */
export function ThoughtBlock({ thought }: ThoughtBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Truncate response for preview
  const preview = thought.response.slice(0, 100);
  const isTruncated = thought.response.length > 100;

  return (
    <div className="thought-block ml-6 border-l-2 border-dashed border-gray-300 pl-4 py-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-start gap-2 text-sm text-gray-600 hover:text-gray-800"
      >
        <span className="flex-shrink-0 mt-0.5" title="Agent thought">
          🧠
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
              {thought.agentId}
            </span>
            <span className="text-xs text-gray-500">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>

          {!isExpanded && (
            <p className="text-xs text-gray-600 italic">
              {preview}{isTruncated && '...'}
            </p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-500 mb-1 font-semibold">Prompt:</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {thought.prompt}
            </p>
          </div>

          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-500 mb-1 font-semibold">Response:</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {thought.response}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
