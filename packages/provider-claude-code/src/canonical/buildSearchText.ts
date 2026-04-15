import type { CanonicalEvent, SessionArtifact } from '@howicc/canonical'
import { stripLowercaseXmlLikeTags } from '../parse/displayTags'

export const buildSearchText = (input: {
  metadata: {
    customTitle?: string
    summary?: string
    tag?: string
    cwd?: string
    gitBranch?: string
  }
  events: CanonicalEvent[]
  artifacts: SessionArtifact[]
}): string => {
  const eventText = input.events
    .flatMap(event => {
      switch (event.type) {
        case 'user_message':
          return event.isMeta ? [] : [event.text]
        case 'assistant_message':
          return [event.text]
        case 'tool_result':
          return event.text ? [stripLowercaseXmlLikeTags(event.text)] : []
        case 'system_notice':
          return event.commandInvocation || HIDDEN_SYSTEM_NOTICE_SUBTYPES.has(event.subtype)
            ? []
            : [stripLowercaseXmlLikeTags(event.text)]
        default:
          return []
      }
    })
    .join('\n')

  const artifactText = input.artifacts
    .flatMap(artifact => {
      switch (artifact.artifactType) {
        case 'plan':
          return [artifact.content]
        case 'question_interaction':
          return [
            ...artifact.questions.map(question => question.question),
            ...Object.values(artifact.answers ?? {}),
          ]
        case 'todo_snapshot':
          return artifact.todos.map(todo => todo.content)
        case 'brief_delivery':
          return [artifact.message]
        default:
          return []
      }
    })
    .join('\n')

  return [
    input.metadata.customTitle,
    input.metadata.summary,
    input.metadata.tag,
    input.metadata.cwd,
    input.metadata.gitBranch,
    eventText,
    artifactText,
  ]
    .filter(Boolean)
    .join('\n')
}

const HIDDEN_SYSTEM_NOTICE_SUBTYPES = new Set([
  'local_command',
  'local_command_output',
  'bash_output',
  'task_notification',
])
