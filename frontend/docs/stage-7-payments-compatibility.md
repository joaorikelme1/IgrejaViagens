# Etapa 7 — pagamentos e compatibilidade financeira

## Contratos utilizados

O módulo consulta `GET /payments`; a visão administrativa também consulta
`GET /users`. A viagem ativa continua vindo do contexto de viagens, alimentado
por `GET /trips`.

Registro, edição, parcelamento e alteração de comprovantes usam o endpoint
granular `PUT /payments/{id}`. O administrador pode configurar o plano de
qualquer viajante associado à viagem ativa e anexar ou substituir comprovantes
sem precisar acessar a sessão do viajante.

O módulo legado não oferece exclusão autônoma de pagamentos, portanto essa ação
não foi acrescentada à interface React. A remoção em cascata associada à
exclusão de viagem continua pertencendo à gestão de viagens migrada na Etapa 4.

A camada `paymentApi.ts` envia apenas o registro alvo e preserva os comprovantes
já carregados. A interface só anuncia sucesso depois que o backend devolve o
pagamento persistido.

## Cálculos exibidos

As funções puras de `paymentCalculations.ts` calculam:

- situação paga, parcial, pendente ou não configurada;
- percentual e quantidade de parcelas pagas;
- total previsto: preço individual multiplicado pelos CPFs únicos da viagem;
- arrecadação estimada: soma do preço individual proporcional às parcelas
  pagas;
- valor pendente: total previsto menos arrecadação;
- progresso da meta configurada, usando o total previsto como fallback.

Entradas negativas, não finitas, parcelamentos zerados e parcelas pagas acima
do total são normalizados. A apresentação nunca produz `NaN`, `Infinity` ou
valor negativo.

Esses valores são estimativas de interface. Preço, parcelas aprovadas,
arrecadação e saldo precisam ser calculados e validados pelo backend em uma
transação autorizada nas Etapas 9/10. O cliente não deve ser fonte contábil.

## Comprovantes

O contrato atual mantém comprovantes dentro de `receiptsJson` como data URL,
incluindo nome, MIME, data, status e eventual motivo de recusa. O React:

- limita uploads a 4 MB e a PNG, JPEG, GIF, WebP ou PDF;
- não persiste arquivos em `localStorage` ou `sessionStorage`;
- incorpora na visualização somente data URLs com MIME permitido;
- renderiza metadados e fallbacks sem `dangerouslySetInnerHTML`;
- permite que o administrador anexe ou substitua arquivos em todas as parcelas;
- mantém alterações locais pendentes até a confirmação do backend;
- recalcula parcelas pagas quando o administrador aprova ou recusa.

Armazenar documentos financeiros como base64 dentro de uma coluna JSON e
retornar a coleção completa não é adequado para produção. O backend futuro deve
usar armazenamento de arquivos privado, limites server-side, verificação de
conteúdo, URLs temporárias e autorização por proprietário/administrador.

## Segurança aplicada

Os endpoints financeiros exigem autenticação, sessão e CSRF nas escritas. O
backend permite que administradores consultem e alterem pagamentos de qualquer
viajante, enquanto viajantes continuam limitados ao próprio CPF e às viagens às
quais estão associados. O poder administrativo não remove essas validações do
servidor nem cria acesso público aos comprovantes.
