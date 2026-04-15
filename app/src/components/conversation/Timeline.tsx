import { useState, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { TimelineEvent } from '@howicc/schemas';
import { TimelineEventItem } from './TimelineEvent';

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export interface TimelineFilter {
  search: string;
  eventTypes: Set<TimelineEvent['type']>;
  showToolResults: boolean;
  showParsingErrors: boolean;
}

/**
 * Timeline component with virtualization for large conversations
 *
 * Features:
 * - Virtual scrolling for performance with large timelines
 * - Client-side filtering and search
 * - Accessible keyboard navigation
 *
 * This component manages state (filters, search) and passes props down to dumb components.
 */
export function Timeline({ events, className = '' }: TimelineProps) {
  const [filters, setFilters] = useState<TimelineFilter>({
    search: '',
    eventTypes: new Set(['user_prompt', 'assistant_turn', 'tool_result', 'parsing_error']),
    showToolResults: true,
    showParsingErrors: true,
  });

  // Memoized filtered events for performance
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter by event type
      if (!filters.eventTypes.has(event.type)) {
        return false;
      }

      // Filter tool results
      if (event.type === 'tool_result' && !filters.showToolResults) {
        return false;
      }

      // Filter parsing errors
      if (event.type === 'parsing_error' && !filters.showParsingErrors) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();

        if (event.type === 'user_prompt') {
          return event.content.toLowerCase().includes(searchLower);
        }

        if (event.type === 'assistant_turn') {
          return event.content.some((block) => {
            if (block.type === 'text_block') {
              return block.text.toLowerCase().includes(searchLower);
            }
            if (block.type === 'tool_call_block') {
              return block.toolName.toLowerCase().includes(searchLower);
            }
            return false;
          });
        }

        if (event.type === 'tool_result') {
          const contentMatch =
            event.content?.toLowerCase().includes(searchLower) || false;
          const structuredMatch = event.structuredContent
            ? JSON.stringify(event.structuredContent)
                .toLowerCase()
                .includes(searchLower)
            : false;
          return (
            event.toolName.toLowerCase().includes(searchLower) ||
            contentMatch ||
            structuredMatch
          );
        }

        if (event.type === 'parsing_error') {
          return event.error.toLowerCase().includes(searchLower);
        }
      }

      return true;
    });
  }, [events, filters]);

  return (
    <div className={`timeline-container ${className}`}>
      {/* Filter controls */}
      <div className="timeline-filters mb-6 flex flex-col gap-4">
        <input
          type="search"
          placeholder="Search timeline..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search timeline events"
        />

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.showToolResults}
              onChange={(e) => setFilters({ ...filters, showToolResults: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Show tool results</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.showParsingErrors}
              onChange={(e) => setFilters({ ...filters, showParsingErrors: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Show parsing errors</span>
          </label>
        </div>
      </div>

      {/* Virtualized timeline */}
      <Virtuoso
        data={filteredEvents}
        itemContent={(index, event) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            index={index}
          />
        )}
        className="timeline-virtuoso"
        style={{ height: '70vh' }}
        increaseViewportBy={200}
      />

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {filters.search ? (
            <p>No events match your search.</p>
          ) : (
            <p>No events to display.</p>
          )}
        </div>
      )}
    </div>
  );
}
