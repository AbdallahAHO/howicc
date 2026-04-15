import type { AssistantTurnEvent as AssistantTurnEventType } from '@howicc/schemas';
import { TextBlock } from './TextBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { ThoughtBlock } from './ThoughtBlock';

export interface AssistantTurnEventProps {
  event: AssistantTurnEventType;
  index: number;
}

/**
 * Dumb component for rendering assistant turns
 * Delegates to TextBlock, ToolCallBlock, and ThoughtBlock components
 */
export function AssistantTurnEvent({ event, index }: AssistantTurnEventProps) {
  const timestamp = new Date(event.timestamp).toLocaleString();

  return (
    <div
      className="timeline-event assistant-turn mb-4 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg"
      data-event-id={event.id}
      data-event-index={index}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-semibold">
          C
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-purple-900">Claude</h3>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                {event.model}
              </span>
            </div>
            <time
              className="text-xs text-gray-500"
              dateTime={event.timestamp}
              title={timestamp}
            >
              {timestamp}
            </time>
          </div>

          {/* Render content blocks */}
          <div className="space-y-3">
            {event.content.map((block, blockIndex) => {
              if (block.type === "text_block") {
                return (
                  <TextBlock
                    key={`${event.id}-text-${blockIndex}`}
                    block={block}
                  />
                );
              }

              if (block.type === "tool_call_block") {
                return <ToolCallBlock key={block.id} block={block} />;
              }

              return null;
            })}
          </div>

          {/* Render agent thoughts if present */}
          {event.thoughts && event.thoughts.length > 0 && (
            <div className="mt-4 space-y-2">
              {event.thoughts.map((thought, thoughtIndex) => (
                <ThoughtBlock
                  key={`${event.id}-thought-${thoughtIndex}`}
                  thought={thought}
                />
              ))}
            </div>
          )}

          {/* Stop reason indicator */}
          {event.stopReason && event.stopReason !== "end_turn" && (
            <div className="mt-2 text-xs text-gray-500">
              Stop reason: {event.stopReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
