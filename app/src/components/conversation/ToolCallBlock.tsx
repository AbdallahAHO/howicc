import { useState } from 'react';
import type { ToolCallBlock as ToolCallBlockType } from '@howicc/schemas';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'react-diff-view/style/index.css';

export interface ToolCallBlockProps {
  block: ToolCallBlockType;
}

/**
 * Get Prism language from file extension
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'py': 'python',
    'json': 'json',
    'sh': 'bash',
    'bash': 'bash',
  };
  return langMap[ext || ''] || 'typescript';
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
          if (change.type === 'normal' || change.type === 'insert' || change.type === 'delete') {
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
    console.error('Error tokenizing code:', error);
    return hunks;
  }
}

/**
 * Dumb component for rendering tool calls with syntax-highlighted diffs
 * Displays tool name, input parameters, and file patches with unified diff format
 */
export function ToolCallBlock({ block }: ToolCallBlockProps) {
  const [expandedPatches, setExpandedPatches] = useState<Set<number>>(new Set());

  const togglePatch = (index: number) => {
    setExpandedPatches(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="tool-call-block bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">
          🔧 {block.toolName}
        </span>
      </div>

      {/* Tool input parameters */}
      {Object.keys(block.input).length > 0 && (
        <details className="mb-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
            Input parameters
          </summary>
          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </details>
      )}

      {/* File patches with syntax highlighting */}
      {block.filePatches && block.filePatches.length > 0 && (
        <div className="file-patches mt-2 space-y-2">
          {block.filePatches.map((patch, index) => {
            const isExpanded = expandedPatches.has(index);
            const language = getLanguageFromPath(patch.filePath);

            // Parse diff
            let parsedDiff: any[] = [];
            try {
              parsedDiff = parseDiff(patch.diff, { nearbySequences: 'zip' });
            } catch (error) {
              console.error('Error parsing diff:', error);
            }

            return (
              <div key={index} className="file-patch bg-white border border-gray-200 rounded">
                <button
                  onClick={() => togglePatch(index)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-700">
                      {patch.filePath}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      patch.type === 'create' ? 'bg-green-100 text-green-800' :
                      patch.type === 'delete' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {patch.type}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {isExpanded && parsedDiff.length > 0 && (
                  <div className="diff-container border-t border-gray-200 overflow-x-auto">
                    {parsedDiff.map((file, fileIndex) => {
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
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
