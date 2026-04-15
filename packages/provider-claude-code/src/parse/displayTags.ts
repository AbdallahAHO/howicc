const LOWERCASE_XML_LIKE_TAG_PATTERN = /<\/?([a-z][\w-]*)(?:\s[^>]*)?>/g

export const stripLowercaseXmlLikeTags = (text: string): string =>
  text
    .replace(LOWERCASE_XML_LIKE_TAG_PATTERN, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
