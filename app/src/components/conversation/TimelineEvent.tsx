import type { TimelineEvent } from '@howicc/schemas';
import { UserPromptEvent } from './UserPromptEvent';
import { AssistantTurnEvent } from './AssistantTurnEvent';
import { ToolResultEvent } from './ToolResultEvent';
import { ParsingErrorEvent } from './ParsingErrorEvent';

export interface TimelineEventItemProps {
  event: TimelineEvent;
  index: number;
}

/**
 * Router component that delegates to specific event type components
 * This is a dumb component that only routes based on discriminated union type
 */
export function TimelineEventItem({ event, index }: TimelineEventItemProps) {
  switch (event.type) {
    case 'user_prompt':
      return <UserPromptEvent event={event} index={index} />;

    case 'assistant_turn':
      return <AssistantTurnEvent event={event} index={index} />;

    case 'tool_result':
      return <ToolResultEvent event={event} index={index} />;

    case 'parsing_error':
      return <ParsingErrorEvent event={event} index={index} />;

    default:
      // TypeScript exhaustiveness check - this should never execute
      const exhaustiveCheck: never = event;
      void exhaustiveCheck; // Consume the value to avoid unused variable error
      return null;
  }
}
