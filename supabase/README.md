# Supabase — Igreja Viagens

Execute `supabase db push` em um projeto novo e vazio. Em **Auth > Providers > Email**, desative a confirmação de e-mail: o sistema usa um e-mail interno derivado do CPF, nunca exibido na interface.

Defina os secrets das Edge Functions: `BOOTSTRAP_ADMIN_SECRET` e `GROQ_API_KEY`. Opcionalmente, defina `GROQ_MODEL` para escolher um modelo ativo na sua conta Groq; se omitido, o assistente usa `openai/gpt-oss-20b`. O runtime já fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; nunca copie essas chaves para o frontend, Vercel ou repositório. Em **Auth > Providers > Email**, mantenha a confirmação de e-mail desativada, pois o login usa uma identidade interna associada ao CPF.

Faça deploy com `supabase functions deploy provision-user` e `supabase functions deploy assistant-chat`. A função de provisionamento não exige JWT no gateway exclusivamente para permitir o bootstrap; ela própria recusa qualquer chamada sem administrador autenticado ou sem o segredo de bootstrap quando ainda não há perfis. O assistente exige JWT e perfil de administrador, e só envia o comando à Groq; a aplicação continua exigindo confirmação para toda alteração. Os buckets privados, limites MIME, RLS, RPCs e tabelas são criados pela migration.

## Retenção de viagens

Uma tarefa diária do Supabase Cron remove automaticamente cada viagem cuja data de partida completou três meses. A limpeza remove os comprovantes de pagamento do Storage antes de excluir a viagem e seus dados relacionados em cascata. Viagens sem data de partida não são removidas automaticamente.
