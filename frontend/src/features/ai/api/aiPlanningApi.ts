import { httpRequest } from '../../../lib/http'
import type {
  AiPlan,
  AiPlanApplication,
  AiPlanningFocus,
  AiPlanningStatus,
  AiUsage,
  TravelerPlanningPreference,
  TravelerPlanningPreferenceMutation,
} from '../model/aiPlanningTypes'

export function getAiPlanningStatus() {
  return httpRequest<AiPlanningStatus>('/ai/status')
}

export function getAiUsage(tripId: string) {
  return httpRequest<AiUsage>(`/ai/usage?tripId=${encodeURIComponent(tripId)}`)
}

export function listAiPlans(tripId: string) {
  return httpRequest<AiPlan[]>(
    `/ai/plans?tripId=${encodeURIComponent(tripId)}`,
  )
}

export function generateAiPlan(tripId: string, focus: AiPlanningFocus) {
  return httpRequest<AiPlan>('/ai/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, focus }),
    timeoutMs: 30_000,
  })
}

export function applyAiPlan(planId: string) {
  return httpRequest<AiPlanApplication>(
    `/ai/plans/${encodeURIComponent(planId)}/apply`,
    { method: 'POST', timeoutMs: 30_000 },
  )
}

export function discardAiPlan(planId: string) {
  return httpRequest<AiPlan>(
    `/ai/plans/${encodeURIComponent(planId)}/discard`,
    { method: 'POST' },
  )
}

export function listTravelerPlanningPreferences(tripId: string) {
  return httpRequest<TravelerPlanningPreference[]>(
    `/ai/preferences?tripId=${encodeURIComponent(tripId)}`,
  )
}

export function saveTravelerPlanningPreference(
  tripId: string,
  userCpf: string,
  preference: TravelerPlanningPreferenceMutation,
) {
  return httpRequest<TravelerPlanningPreference>(
    `/ai/preferences/${encodeURIComponent(userCpf)}?tripId=${encodeURIComponent(tripId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    },
  )
}

export function deleteTravelerPlanningPreference(
  tripId: string,
  userCpf: string,
) {
  return httpRequest<void>(
    `/ai/preferences/${encodeURIComponent(userCpf)}?tripId=${encodeURIComponent(tripId)}`,
    { method: 'DELETE' },
  )
}
