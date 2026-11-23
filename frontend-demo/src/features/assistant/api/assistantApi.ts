import { parseAssistantCommand } from '../lib/assistantParser'
import type { ParsedAssistantCommand } from '../model/assistantTypes'

export async function interpretAssistantCommand(command: string, _tripId: string): Promise<ParsedAssistantCommand> {
  return parseAssistantCommand(command)
}
