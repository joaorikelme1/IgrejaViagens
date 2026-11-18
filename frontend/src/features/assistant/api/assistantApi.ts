import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import type { ParsedAssistantCommand } from '../model/assistantTypes'

export async function interpretAssistantCommand(
  command: string,
  tripId: string,
): Promise<ParsedAssistantCommand> {
  const result = unwrap<ParsedAssistantCommand>(
    await supabase.functions.invoke('assistant-chat', {
      body: { command, tripId },
    }),
  )

  if (
    !result?.intent &&
    !result?.clarification &&
    !('answer' in result && result.answer)
  ) {
    throw new Error('A IA retornou uma resposta inválida. Tente novamente.')
  }
  return result
}
