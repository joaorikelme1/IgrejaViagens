import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'content-type': 'application/json' }
const cpf = (value: unknown) => String(value ?? '').replace(/\D/g, '')
const internalEmail = (value: string) => `${value}@auth.igreja-viagens.invalid`

Deno.serve(async (request) => {
  try {
    const body = await request.json()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const { data: caller } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
    const bootstrap = request.headers.get('x-bootstrap-secret')
    const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true })
    const bootstrapAllowed = count === 0 && bootstrap && bootstrap === Deno.env.get('BOOTSTRAP_ADMIN_SECRET')
    if (!bootstrapAllowed) {
      if (!caller.user) return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers })
      const { data: profile } = await admin.from('profiles').select('role').eq('id', caller.user.id).maybeSingle()
      if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers })
    }
    if (body.action === 'delete') {
      if (bootstrapAllowed || !body.userId) return new Response(JSON.stringify({ error: 'Operação inválida.' }), { status: 400, headers })
      const { error } = await admin.auth.admin.deleteUser(String(body.userId))
      if (error) throw error
      return new Response(null, { status: 204 })
    }
    const value = cpf(body.cpf)
    if (!/^\d{11}$/.test(value) || typeof body.password !== 'string' || body.password.length < 8) {
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao provisionar usuário.' }), { status: 400, headers })
  }
})
