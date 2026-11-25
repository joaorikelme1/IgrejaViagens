import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isValidCpf, normalizeCpf } from '../_shared/cpf.ts'

const headers = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const internalEmail = (value: string) => `${value}@auth.igreja-viagens.invalid`
const safeEqual = (left: string | null, right: string | undefined) => {
  if (!left || !right) return false
  const size = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    const body = await request.json()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const { data: caller } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
    const bootstrap = request.headers.get('x-bootstrap-secret')
    const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true })
    const bootstrapAllowed = count === 0 && safeEqual(bootstrap, Deno.env.get('BOOTSTRAP_ADMIN_SECRET'))
    if (!bootstrapAllowed) {
      if (!caller.user) return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers })
      const { data: profile } = await admin.from('profiles').select('role').eq('id', caller.user.id).maybeSingle()
      if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers })
    }
    if (body.action === 'delete') {
      if (bootstrapAllowed || !body.userId) return new Response(JSON.stringify({ error: 'Operação inválida.' }), { status: 400, headers })
      const userId = String(body.userId ?? '')
      const { data: target, error: targetError } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
      if (targetError) throw targetError
      if (!target) return new Response(JSON.stringify({ error: 'Usuário não encontrado.' }), { status: 404, headers })
      if (target.role === 'admin') {
        const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
        if (countError) throw countError
        if ((count ?? 0) <= 1) return new Response(JSON.stringify({ error: 'Não é possível excluir o último administrador do sistema.' }), { status: 409, headers })
      }
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw error
      return new Response(null, { status: 204, headers })
    }
    if (body.action === 'reset-password') {
      if (bootstrapAllowed || !body.userId || typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 72 || !/[a-zA-Z]/.test(body.password) || !/\d/.test(body.password)) {
        return new Response(JSON.stringify({ error: 'Redefinição de senha inválida.' }), { status: 400, headers })
      }
      const { error } = await admin.auth.admin.updateUserById(String(body.userId), { password: body.password })
      if (error) throw error
      const { error: profileError } = await admin.from('profiles').update({ first_login: true }).eq('id', String(body.userId))
      if (profileError) throw profileError
      return new Response(null, { status: 204, headers })
    }
    const value = normalizeCpf(body.cpf)
    if (!isValidCpf(value) || typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 72 || !/[a-zA-Z]/.test(body.password) || !/\d/.test(body.password) || !String(body.name ?? '').trim()) {
      return new Response(JSON.stringify({ error: 'Dados de provisionamento inválidos.' }), { status: 400, headers })
    }
    const role = bootstrapAllowed ? 'admin' : (body.role === 'admin' ? 'admin' : 'traveler')
    const { data, error } = await admin.auth.admin.createUser({
      email: internalEmail(value), password: body.password, email_confirm: true,
      user_metadata: { cpf: value },
    })
    if (error || !data.user) throw error ?? new Error('Usuário não criado.')
    const { error: profileError } = await admin.from('profiles').insert({
      id: data.user.id, cpf: value, name: String(body.name ?? '').trim(), role,
      birthdate: body.birthdate || null, first_login: body.firstLogin !== false,
      married: Boolean(body.married), spouse_name: body.spouseName || '', has_kids: Boolean(body.hasKids),
    })
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); throw profileError }
    return new Response(JSON.stringify({ id: data.user.id }), { status: 201, headers })
  } catch (error) {
    console.error('User provisioning failed', error)
    const duplicate = error instanceof Error && /already registered|duplicate|unique/i.test(error.message)
    return new Response(JSON.stringify({ error: duplicate ? 'CPF já cadastrado.' : 'Não foi possível concluir a operação de usuário.' }), { status: duplicate ? 409 : 400, headers })
  }
})
