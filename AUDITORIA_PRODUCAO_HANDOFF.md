# Continuação da auditoria técnica — IgrejaViagens

Este documento transfere o contexto da auditoria e preparação para produção para outra sessão do Codex. Leia este arquivo antes de fazer novas alterações e use o código atual como fonte de verdade.

## Objetivo em andamento

Auditar e preparar o IgrejaViagens para uso por usuários reais, com foco em segurança, autenticação, RLS, integridade financeira, transporte, hospedagem, assistente administrativo, experiência do usuário, desempenho, testes e documentação.

O projeto deve continuar usando React, TypeScript, Vite e Supabase. Não reconstruir do zero, não alterar regras de negócio sem justificativa, não expor secrets, não modificar produção sem autorização e não excluir dados reais.

## Estado do Git

- Repositório: `https://github.com/joaorikelme1/IgrejaViagens`
- Diretório original: `C:\Projetos\IgrejaViagens`
- Branch de trabalho: `codex/auditoria-producao-20261125`
- Commit-base: `8fef7e5`
- As alterações estão no working tree e ainda não foram commitadas.
- Nenhuma migration foi aplicada remotamente.
- Nenhuma Edge Function foi publicada.
- Nenhum deploy foi realizado na Vercel ou no Supabase.

Antes de continuar, executar:

```powershell
git status --short --branch
git diff --check
```

Preservar todas as alterações locais existentes. Não usar `git reset --hard`, `git checkout --` ou comandos destrutivos.

## Estrutura identificada

- `frontend/`: aplicação principal React 19, TypeScript, Vite e Supabase.
- `frontend-demo/`: demonstração isolada em `localStorage`/`sessionStorage`, sem acesso ao Supabase.
- `supabase/`: migrations, testes pgTAP/RLS e Edge Functions.
- `backend/`: backend Java/Spring legado, sem integração encontrada com o frontend atual. Deve permanecer desativado até decisão explícita sobre arquivamento.

## Problemas críticos encontrados inicialmente

- Primeiro acesso era controlado principalmente pelo cliente e podia ser contornado restaurando uma sessão.
- CPF era validado pelos dígitos verificadores somente no frontend.
- Viajante tentava usar uma RPC administrativa para salvar o próprio plano de pagamento.
- Aprovação de comprovantes era feita em múltiplas operações, sem atomicidade.
- Faltava trilha de auditoria financeira.
- Arquivos de comprovantes não tinham validação server-side suficiente de proprietário, caminho, MIME e tamanho.
- O banco não impedia diretamente capacidade excedida de quartos ou assentos em escritas fora das RPCs.
- RPCs privilegiadas precisavam de revogação explícita das permissões implícitas de `PUBLIC` e `anon`.
- Assistente administrativo não possuía rate limit persistente.
- A demonstração tinha 31 erros de lint e 5 testes falhando.
- Dependências de desenvolvimento apresentavam 16 vulnerabilidades conhecidas.
- Bundle principal tinha aproximadamente 629 KB.

## Alterações já implementadas

### Banco, RLS e integridade

Foi adicionada a migration:

`supabase/migrations/20261125120000_production_hardening.sql`

Ela implementa:

- `public.is_valid_cpf(text)` com validação dos dígitos verificadores.
- Constraint de CPF em `profiles`.
- Validação prévia que interrompe a migration se já existirem CPFs inválidos.
- Cascata referencial entre perfil e vínculos de viagem para exclusão atômica via Auth.
- `public.has_completed_first_access()`.
- Proteção de `role`, `cpf`, `first_login` e dados administrativos no trigger de perfil.
- `save_own_payment_plan`, limitada ao próprio viajante e à própria viagem.
- Triggers de capacidade para quartos, ônibus e assentos.
- Proteção contra redução de capacidade abaixo da ocupação atual.
- Tabela `payment_audit_log` com leitura apenas administrativa.
- `submit_payment_receipt` com validação do pagamento, parcela, proprietário do objeto, caminho, MIME e tamanho máximo de 4 MiB.
- `review_payment_receipt` com aprovação/rejeição atômica, motivo obrigatório de rejeição e controle de versão.
- Recálculo transacional de `paid_installments`.
- Políticas privadas do Storage para comprovantes.
- Política de atualização da foto de perfil pelo proprietário.
- `assistant_request_log` e `consume_assistant_quota`.
- Limite do assistente de 20 requisições/minuto e 500/dia por administrador.
- Revogação de execução pública/anônima em RPCs privilegiadas.
- RLS exigindo conclusão do primeiro acesso para dados operacionais e financeiros do viajante.

A migration não altera a política existente de exclusão de viagens após três meses. Essa política permanece pendente de decisão do responsável pelo sistema.

### Edge Functions e autenticação

- Adicionado `supabase/functions/_shared/cpf.ts`.
- Adicionada `supabase/functions/complete-first-access/index.ts`.
- Atualizado `supabase/config.toml` para exigir JWT nessa função.
- `provision-user` agora valida CPF, nome e senha no servidor.
- Senhas temporárias exigem 10–72 caracteres, letras e números.
- Adicionada ação administrativa `reset-password`, que redefine a senha e ativa `first_login` novamente.
- Bootstrap secret recebeu comparação resistente a diferenças simples de tempo.
- Erros sensíveis são registrados no servidor, mas não retornados integralmente ao cliente.
- Exclusão de usuário usa diretamente `auth.admin.deleteUser`; a nova FK em cascata cuida dos vínculos.
- `assistant-chat` consome a cota persistente e retorna HTTP 429 com `Retry-After`.

### Frontend principal

- Login valida CPF real.
- Conclusão do primeiro acesso chama a nova Edge Function.
- Uma sessão restaurada com `first_login=true` é encerrada para impedir bypass por recarregamento.
- Modal de primeiro acesso usa a nova política de senha.
- Formulário administrativo de usuário usa a mesma política.
- Adicionado `ResetPasswordModal.tsx` e botão de redefinição na gestão de usuários.
- Viajante salva o próprio plano pela RPC `save_own_payment_plan`.
- Aprovação/rejeição usa `review_payment_receipt`.
- Uploads usam `submit_payment_receipt`; arquivo órfão é removido se a vinculação falhar.
- GIF foi removido dos formatos de comprovante aceitos.
- Valores monetários são distribuídos em centavos de forma determinística.
- Rotas principais usam lazy loading e `Suspense`.
- Adicionados foco visível e suporte a `prefers-reduced-motion`.

### Demonstração

- Continua totalmente isolada de produção.
- Corrigidos lint e testes que ainda esperavam comportamento do Supabase.
- Corrigidos cálculos monetários e relatórios para usar centavos deterministicamente.
- GIF removido dos comprovantes.
- Adicionados foco visível e redução de movimento.

### Dependências, CI e documentação

- Atualizados ESLint, TypeScript ESLint, Vite e Vitest no frontend e demo.
- `npm audit` passou a reportar zero vulnerabilidades nos dois projetos.
- Criado `.github/workflows/ci.yml` com validações do frontend, demo, Supabase e backend Java.
- Atualizado `README.md` principal.
- Atualizados `supabase/README.md` e `backend/README.md`.
- O backend Java foi documentado como legado e não integrado. Ele ainda aceita compatibilidade com senhas antigas em texto puro e não deve ser colocado em produção.

## Resultados reais já obtidos

### Frontend principal

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run test`: passou — 38 arquivos e 144 testes.
- `npm run build`: passou.
- `npm audit`: zero vulnerabilidades.
- Bundle principal caiu de aproximadamente 629 KB para 495 KB.

### Demonstração

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run test`: passou — 38 arquivos e 118 testes.
- `npm run build`: passou.
- `npm audit`: zero vulnerabilidades.

### Backend legado

- `.\gradlew.bat test`: passou.

### Repositório

- `git diff --check`: passou; existem apenas avisos informativos de conversão LF/CRLF.
- Não foram encontrados tokens JWT, chaves Groq ou Supabase secrets adicionados ao código.

## Validações que não puderam ser concluídas

Os comandos abaixo foram tentados, mas o Postgres local do Supabase não estava disponível em `127.0.0.1:54322`, pois o Docker não estava em execução:

```powershell
npx supabase db lint
npx supabase test db
```

Não usar `--remote` para contornar isso. O repositório estava vinculado ao projeto remoto `cpkmrzqohcithmsbczmg`, e executar validações ou migrations nele sem autorização pode atingir dados reais.

O Deno também não estava instalado, então as Edge Functions não receberam uma verificação isolada por `deno check`.

Por esses motivos, o projeto ainda não deve ser classificado como pronto para produção.

## Testes SQL adicionados

O arquivo `supabase/tests/database/001_schema_and_rls.sql` possui plano pgTAP com 44 asserções, incluindo:

- Validação de CPF.
- Existência das novas funções e tabela de auditoria.
- Existência dos triggers de capacidade.
- Permissões das RPCs.
- Bloqueio de consumo direto da cota do assistente.
- Leitura do próprio perfil e pagamento.
- Bloqueio da leitura de dados de terceiros.
- Bloqueio de autopromoção para administrador.
- Bloqueio de RPC administrativa para viajante.

Esses testes foram revisados estaticamente, mas ainda precisam ser executados contra o Supabase local.

## Pendências conhecidas

1. Iniciar Docker/Supabase local e executar a migration do zero.
2. Rodar `npx supabase db lint` e `npx supabase test db`.
3. Instalar Deno e verificar as Edge Functions.
4. Executar testes E2E reais em navegador para admin e viajante.
5. Testar concorrência real de assentos, quartos e aprovação financeira.
6. Validar falha de rede durante upload, substituição e aprovação de comprovantes.
7. Validar Groq indisponível, timeout, rate limit e prompt injection em staging.
8. Revisar acessibilidade manualmente com teclado, leitor de tela e dispositivos móveis.
9. Avaliar paginação e excesso de URLs assinadas na tela administrativa de pagamentos.
10. Definir se distribuições simultâneas devem usar controle de versão. Atualmente são transacionais, mas a última escrita válida pode substituir a anterior.
11. Definir o modelo de vencimento das parcelas. O esquema atual não possui datas mensais suficientes para classificar atraso real com precisão.
12. Decidir sobre a política de retenção de três meses.

## Retenção de dados — não alterar sem autorização

A migration existente `supabase/migrations/20261118200000_purge_expired_trips.sql` exclui viagens e comprovantes após três meses.

Isso pode eliminar histórico financeiro, trilha operacional e documentos necessários para prestação de contas. Recomenda-se avaliar:

- Arquivamento ou soft delete.
- Separação entre viagem ativa e encerrada.
- Retenção financeira e de comprovantes por prazo definido.
- Backups e processo formal de expurgo.

Não alterar essa regra até receber autorização e definição de negócio.

## Próximos passos recomendados no outro computador

1. Confirmar que a branch correta está ativa.
2. Instalar Node compatível e Docker Desktop.
3. Executar `npm ci` em `frontend/` e `frontend-demo/`.
4. Executar todas as validações do frontend e demo.
5. Iniciar Supabase local com `npx supabase start`.
6. Aplicar as migrations somente no banco local isolado.
7. Executar DB lint e pgTAP.
8. Corrigir qualquer erro real encontrado sem esconder falhas nos testes.
9. Criar staging separado antes de qualquer aplicação remota.
10. Somente publicar em produção após autorização explícita, backup e smoke tests em staging.

## Checklist manual mínimo

- Login com CPF válido e inválido.
- Primeiro acesso, recarregamento da página e tentativa de acesso direto às APIs.
- Redefinição administrativa de senha e novo primeiro acesso.
- Logout, sessão expirada e renovação de sessão.
- Viajante tentando consultar ou modificar perfil, viagem e pagamento de terceiros.
- Viajante tentando executar RPC administrativa ou alterar o próprio papel.
- Plano de pagamento próprio, bloqueio do plano e valores com divisão não exata em centavos.
- Upload de comprovante válido, inválido, grande, repetido e interrompido.
- Aprovação/rejeição simultânea do mesmo comprovante.
- Dois administradores tentando ocupar o mesmo assento.
- Quarto lotado, ônibus lotado, família grande e quartos insuficientes.
- Remoção/redução de ônibus ou quarto ocupado.
- Assistente sem Groq, com timeout, limite excedido e tentativa de prompt injection.
- Navegação a 320 px, teclado, foco visível e leitor de tela.

## Instrução para a próxima sessão do Codex

Continue a partir do estado atual. Não refaça a aplicação e não descarte as alterações. Primeiro valide a migration e os testes RLS em ambiente local isolado. Trate qualquer falha como resultado real. Não aplique nada no Supabase remoto e não publique na Vercel sem autorização explícita do usuário.
