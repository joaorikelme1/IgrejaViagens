import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 10 && value.length <= 72
    && /[a-zA-Z]/.test(value) && /\d/.test(value)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Não autenticado.' }, 401)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data, error: userError } = await admin.auth.getUser(token)
    if (userError || !data.user) return json({ error: 'Não autenticado.' }, 401)
    const body = await request.json().catch(() => null)
    if (!validPassword(body?.password)) {
      return json({ error: 'Use uma senha de 10 a 72 caracteres, com letras e números.' }, 400)
    }
    const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile) return json({ error: 'Perfil não encontrado.' }, 404)
    const { error: passwordError } = await admin.auth.admin.updateUserById(data.user.id, { password: body.password })
    if (passwordError) throw passwordError
    const { error: updateError } = await admin.from('profiles').update({ first_login: false }).eq('id', data.user.id)
    if (updateError) throw updateError
    return json({ completed: true })
  } catch (error) {
    console.error('First access completion failed', error)
    return json({ error: 'Não foi possível concluir o primeiro acesso.' }, 500)
  }
})
