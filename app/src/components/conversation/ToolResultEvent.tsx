import { useState } from 'react';
import type {
  ToolResultEvent as ToolResultEventType,
  StructuredToolContent,
} from "@howicc/schemas";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "react-diff-view/style/index.css";

export interface ToolResultEventProps {
  event: ToolResultEventType;
  index: number;
}

/**
 * Get Prism language from file extension
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    json: "json",
    sh: "bash",
    bash: "bash",
  };
  return langMap[ext || ""] || "typescript";
}

/**
 * Tokenize code with Prism for syntax highlighting
 */
function tokenize(hunks: any[], language: string) {
  if (!hunks) {
    return undefined;
  }

  try {
    return hunks.map((hunk: any) => {
      return {
        ...hunk,
        changes: hunk.changes.map((change: any) => {
          if (
            change.type === "normal" ||
            change.type === "insert" ||
            change.type === "delete"
          ) {
            const tokens = Prism.highlight(
              change.content,
              Prism.languages[language] || Prism.languages.typescript,
              language
            );
            return {
              ...change,
              tokens,
            };
          }
          return change;
        }),
      };
    });
  } catch (error) {
    console.error("Error tokenizing code:", error);
    return hunks;
  }
}

/**
 * Render structured content based on type
 */
function renderStructuredContent(content: StructuredToolContent) {
  switch (content.type) {
    case 'file_edit':
      return (
        <div className="file-edit-result">
          <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
            <span>📝 File Edit:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">
              {content.oldPath}
            </code>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded overflow-hidden">
            {(() => {
              try {
                const parsedDiff = parseDiff(content.diff, {
                  nearbySequences: "zip",
                });
                const language = getLanguageFromPath(content.oldPath);
                return parsedDiff.map((file, fileIndex) => {
                  const tokenizedHunks = tokenize(file.hunks, language);
                  return (
                    <Diff
                      key={fileIndex}
                      viewType="unified"
                      diffType={file.type}
                      hunks={tokenizedHunks || file.hunks}
                    >
                      {(hunks: any[]) =>
                        hunks.map((hunk: any) => (
                          <Hunk key={hunk.content} hunk={hunk} />
                        ))
                      }
                    </Diff>
                  );
                });
              } catch (error) {
                return (
                  <pre className="text-xs p-3 overflow-x-auto font-mono">
                    {content.diff}
                  </pre>
                );
              }
            })()}
          </div>
        </div>
      );

    case 'command':
      return (
        <div className="command-result">
          <div className="text-xs text-gray-600 mb-2 flex items-center gap-2 flex-wrap">
            <span>💻 Command:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">
              {content.command}
            </code>
            {content.exitCode !== undefined && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  content.exitCode === 0
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                Exit Code: {content.exitCode}
              </span>
            )}
          </div>
          <div className="bg-gray-900 text-gray-100 rounded border border-gray-700 overflow-hidden">
            <pre className="text-xs p-3 overflow-x-auto whitespace-pre-wrap font-mono">
              {content.stdout}
            </pre>
          </div>
        </div>
      );

    case 'todo':
      return (
        <div className="todo-result">
          <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
            <span>✅ TODO List Update</span>
            <span className="text-gray-400">
              ({content.oldTodos.length} → {content.newTodos.length} items)
            </span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-red-600">−</span>
                  <span>Removed ({content.oldTodos.length})</span>
                </div>
                <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                  {content.oldTodos.length === 0 ? (
                    <li className="text-gray-400 italic">No items removed</li>
                  ) : (
                    <>
                      {content.oldTodos
                        .slice(0, 10)
                        .map((todo: any, i: number) => (
                          <li
                            key={i}
                            className="text-gray-700 bg-red-50 px-2 py-1 rounded border-l-2 border-red-300"
                          >
                            {typeof todo === "string"
                              ? todo
                              : JSON.stringify(todo).slice(0, 100)}
                          </li>
                        ))}
                      {content.oldTodos.length > 10 && (
                        <li className="text-gray-400 italic text-center pt-1">
                          ...and {content.oldTodos.length - 10} more
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-green-600">+</span>
                  <span>Added ({content.newTodos.length})</span>
                </div>
                <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                  {content.newTodos.length === 0 ? (
                    <li className="text-gray-400 italic">No items added</li>
                  ) : (
                    <>
                      {content.newTodos
                        .slice(0, 10)
                        .map((todo: any, i: number) => (
                          <li
                            key={i}
                            className="text-gray-700 bg-green-50 px-2 py-1 rounded border-l-2 border-green-300"
                          >
                            {typeof todo === "string"
                              ? todo
                              : JSON.stringify(todo).slice(0, 100)}
                          </li>
                        ))}
                      {content.newTodos.length > 10 && (
                        <li className="text-gray-400 italic text-center pt-1">
                          ...and {content.newTodos.length - 10} more
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      );

    case 'text':
      return (
        <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
          {content.content}
        </pre>
      );

    default:
      return null;
  }
}

/**
 * Dumb component for rendering tool execution results
 * Displays tool name, status, and output content (truncated by default)
 * Supports both legacy content and new structuredContent
 */
export function ToolResultEvent({ event, index }: ToolResultEventProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timestamp = new Date(event.timestamp).toLocaleString();

  // Use structured content if available, otherwise fall back to legacy content
  const hasStructuredContent = !!event.structuredContent;
  const displayContent = event.content || "";
  const preview = displayContent.slice(0, 200);
  const isTruncated = displayContent.length > 200 && !hasStructuredContent;

  return (
    <div
      className={`timeline-event tool-result mb-4 p-4 rounded-lg border-l-4 ${
        event.status === "success"
          ? "bg-green-50 border-green-500"
          : "bg-red-50 border-red-500"
      }`}
      data-event-id={event.id}
      data-event-index={index}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-semibold text-sm ${
            event.status === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {event.status === "success" ? "✓" : "✗"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Tool Result: {event.toolName}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  event.status === "success"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {event.status}
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

          <div className="bg-white rounded p-3 border border-gray-200">
            {hasStructuredContent ? (
              // Render structured content (file_edit, command, todo, text)
              renderStructuredContent(event.structuredContent!)
            ) : (
              // Legacy: render plain text content
              <>
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {isExpanded ? displayContent : preview}
                  {!isExpanded && isTruncated && "..."}
                </pre>

                {isTruncated && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </>
            )}

            {/* Show summary if available */}
            {event.summary && (
              <div className="mt-2 text-xs text-gray-600 italic border-t border-gray-200 pt-2">
                {event.summary}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
