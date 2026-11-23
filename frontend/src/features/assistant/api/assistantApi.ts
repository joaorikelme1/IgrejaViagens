import { supabase } from '../../../infrastructure/supabase/client'
import type { AssistantQueryContext, ParsedAssistantCommand } from '../model/assistantTypes'

export async function interpretAssistantCommand(
  command: string,
  tripId: string,
  previousContext?: AssistantQueryContext,
): Promise<ParsedAssistantCommand> {
  const response = await supabase.functions.invoke<ParsedAssistantCommand>(
    'assistant-chat',
    { body: { command, previousContext, tripId } },
  )
  if (response.error) {
    const error: unknown = response.error
    const errorRecord = error && typeof error === 'object'
      ? error as Record<string, unknown>
      : null
    const context = errorRecord?.context
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { error?: unknown } | null
      if (typeof payload?.error === 'string') throw new Error(payload.error)
    }
    throw new Error(
      typeof errorRecord?.message === 'string'
        ? errorRecord.message
        : 'Não foi possível consultar o assistente.',
    )
  }
  const result = response.data
  if (!result) {
    throw new Error('A IA retornou uma resposta vazia. Tente novamente.')
  }

  if (
    !result.intent &&
    !result.clarification &&
    !('answer' in result && result.answer)
  ) {
    throw new Error('A IA retornou uma resposta inválida. Tente novamente.')
  }
  return result
}
