import type { TextBlock as TextBlockType } from '@howicc/schemas';

export interface TextBlockProps {
  block: TextBlockType;
}

/**
 * Dumb component for rendering text blocks
 * Displays assistant text responses with markdown-style formatting
 */
export function TextBlock({ block }: TextBlockProps) {
  return (
    <div className="text-block prose prose-sm max-w-none">
      <p className="whitespace-pre-wrap text-gray-800">{block.text}</p>
    </div>
  );
}
