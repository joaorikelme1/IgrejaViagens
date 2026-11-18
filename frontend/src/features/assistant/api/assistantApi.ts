import { supabase } from '../../../infrastructure/supabase/client'
import type { ParsedAssistantCommand } from '../model/assistantTypes'

export async function interpretAssistantCommand(
  command: string,
  tripId: string,
): Promise<ParsedAssistantCommand> {
  const response = await supabase.functions.invoke<ParsedAssistantCommand>(
    'assistant-chat',
    { body: { command, tripId } },
  )
  if (response.error) {
    const context = 'context' in response.error ? response.error.context : null
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { error?: unknown } | null
      if (typeof payload?.error === 'string') throw new Error(payload.error)
    }
    throw new Error(response.error.message)
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
