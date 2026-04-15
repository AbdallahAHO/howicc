import type { QuestionArtifact, SessionArtifact, ToolCallEvent, ToolResultEvent } from '@howicc/canonical'
import { pairToolCallsAndResults } from '../parse/pairToolCalls'

export const extractQuestionArtifacts = (input: {
  toolCalls: ToolCallEvent[]
  toolResults: ToolResultEvent[]
}): SessionArtifact[] => {
  const paired = pairToolCallsAndResults(input.toolCalls, input.toolResults)

  return paired.flatMap(pair => {
    if (pair.call.toolName !== 'AskUserQuestion') return []

    const normalizedQuestions = normalizeQuestionsInput(pair.call.input)
    if (normalizedQuestions.length === 0) return []

    const outcome = classifyQuestionOutcome(pair.result)
    const structuredResult =
      pair.result?.json && typeof pair.result.json === 'object' ? pair.result.json : undefined

    const answers =
      structuredResult && isStringRecord((structuredResult as Record<string, unknown>).answers)
        ? ((structuredResult as Record<string, unknown>).answers as Record<string, string>)
        : undefined

    const annotations =
      structuredResult &&
      typeof (structuredResult as Record<string, unknown>).annotations === 'object' &&
      (structuredResult as Record<string, unknown>).annotations !== null
        ? ((structuredResult as Record<string, unknown>).annotations as Record<string, {
            preview?: string
            notes?: string
          }>)
        : undefined

    const artifact: QuestionArtifact = {
      id: `question:${pair.call.toolUseId}`,
      artifactType: 'question_interaction',
      provider: 'claude_code',
      source: {
        eventIds: [pair.call.id, pair.result?.id].filter(Boolean) as string[],
        toolUseIds: [pair.call.toolUseId],
      },
      outcome,
      questions: normalizedQuestions,
      answers,
      annotations,
      feedbackText: pair.result?.status === 'error' ? pair.result.text : undefined,
    }

    return [artifact]
  })
}

const normalizeQuestionsInput = (input: unknown): QuestionArtifact['questions'] => {
  if (!input || typeof input !== 'object') return []

  const record = input as Record<string, unknown>

  if (Array.isArray(record.questions)) {
    return record.questions
      .map(question => normalizeSingleQuestion(question))
      .filter((question): question is QuestionArtifact['questions'][number] =>
        Boolean(question),
      )
  }

  if (typeof record.question === 'string') {
    return [
      {
        question: record.question,
        header: typeof record.header === 'string' ? record.header : 'Question',
        options: Array.isArray(record.options)
          ? record.options
              .map(option => normalizeOption(option))
              .filter((option): option is QuestionArtifact['questions'][number]['options'][number] =>
                Boolean(option),
              )
          : [],
        multiSelect: false,
      },
    ]
  }

  return []
}

const normalizeSingleQuestion = (
  value: unknown,
): QuestionArtifact['questions'][number] | undefined => {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const question = typeof record.question === 'string' ? record.question : undefined

  if (!question) return undefined

  return {
    question,
    header: typeof record.header === 'string' ? record.header : question,
    options: Array.isArray(record.options)
      ? record.options
          .map(option => normalizeOption(option))
          .filter((option): option is QuestionArtifact['questions'][number]['options'][number] =>
            Boolean(option),
          )
      : [],
    multiSelect: record.multiSelect === true,
  }
}

const normalizeOption = (
  value: unknown,
): QuestionArtifact['questions'][number]['options'][number] | undefined => {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label : undefined

  if (!label) return undefined

  return {
    label,
    description:
      typeof record.description === 'string' ? record.description : '',
    preview: typeof record.preview === 'string' ? record.preview : undefined,
  }
}

const classifyQuestionOutcome = (
  result?: ToolResultEvent,
): QuestionArtifact['outcome'] => {
  if (!result) return 'declined'
  if (result.status !== 'error') return 'answered'

  const text = result.text ?? ''

  if (text.includes('clarify these questions')) {
    return 'redirected'
  }

  if (text.includes('enough answers for the plan interview')) {
    return 'finished_plan_interview'
  }

  return 'declined'
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  Boolean(value) &&
  typeof value === 'object' &&
  Object.values(value as Record<string, unknown>).every(
    entry => typeof entry === 'string',
  )
