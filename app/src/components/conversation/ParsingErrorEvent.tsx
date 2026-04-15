import { useState } from 'react';
import type { ParsingErrorEvent as ParsingErrorEventType } from '@howicc/schemas';

export interface ParsingErrorEventProps {
  event: ParsingErrorEventType;
  index: number;
}

/**
 * Dumb component for rendering parsing errors
 * Displays error details with source file and line number information
 */
export function ParsingErrorEvent({ event, index }: ParsingErrorEventProps) {
  const [showDetails, setShowDetails] = useState(false);
  const timestamp = new Date(event.timestamp).toLocaleString();

  return (
    <div
      className="timeline-event parsing-error mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg"
      data-event-id={event.id}
      data-event-index={index}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
          ⚠️
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-yellow-900">
              Parsing Error
            </h3>
            <time
              className="text-xs text-gray-500"
              dateTime={event.timestamp}
              title={timestamp}
            >
              {timestamp}
            </time>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-yellow-900">{event.error}</p>

            <div className="text-xs text-gray-600">
              <span className="font-mono bg-white px-2 py-1 rounded">
                {event.sourceFile}:{event.lineNumber}
              </span>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>

            {showDetails && (
              <div className="bg-white rounded p-3 border border-yellow-200 mt-2">
                <p className="text-xs text-gray-500 mb-1 font-semibold">
                  Original line:
                </p>
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {event.originalLine}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
