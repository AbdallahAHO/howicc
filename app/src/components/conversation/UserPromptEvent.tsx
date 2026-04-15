import type { UserPromptEvent as UserPromptEventType } from '@howicc/schemas';

export interface UserPromptEventProps {
  event: UserPromptEventType;
  index: number;
}

/**
 * Dumb component for rendering user prompts
 * Displays user messages with timestamp and formatting
 */
export function UserPromptEvent({ event, index }: UserPromptEventProps) {
  const timestamp = new Date(event.timestamp).toLocaleString();

  return (
    <div
      className="timeline-event user-prompt mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg"
      data-event-id={event.id}
      data-event-index={index}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
          U
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-900">User</h3>
            <time
              className="text-xs text-gray-500"
              dateTime={event.timestamp}
              title={timestamp}
            >
              {timestamp}
            </time>
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-gray-800">{event.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
