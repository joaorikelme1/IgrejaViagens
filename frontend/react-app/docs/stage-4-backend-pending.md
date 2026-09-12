# Etapa 4: compatibilidade temporária e pendências do backend

## Decisões desta etapa

- O Dashboard calcula indicadores no cliente apenas para reproduzir o contrato
  atual. Esses valores não são fonte autoritativa para decisões financeiras.
- Os gráficos são SVGs declarativos controlados pelo React, sem manipulação
  direta do DOM e sem dependência adicional.
- A edição envia o objeto completo exigido por `PUT /trips/bulk`, mas mantém
  literalmente `hotelsJson`, `travelersJson`, propriedades desconhecidas dos
  ônibus e identificadores de ônibus existentes.
- A meta continua usando o nome legado `arrecadationGoal`, inclusive na
  serialização, para ser persistida pelo Spring atual.
- A sugestão de meta (`preço × limite de pessoas`) é somente uma ajuda de
  preenchimento. O administrador decide se deseja aplicá-la.
- A lista de “viajantes recentes” usa temporariamente a ordem de
  `travelersJson`, pois o contrato de usuário/viagem não informa data de
  inclusão.
- `GET /users` hoje expõe o modelo persistido. O adaptador do Dashboard descarta
  senha e quaisquer outros campos não necessários antes de disponibilizar os
  dados à interface.

## Pendências obrigatórias para as Etapas 9 e 10

1. Substituir os endpoints `bulk` por operações específicas de criação,
   atualização e exclusão com controle de concorrência.
2. Tornar a exclusão de viagem e a limpeza de pagamentos, assentos e quartos
   uma única transação no backend. A sequência compatível atual não é atômica e
   pode ficar parcialmente concluída em caso de falha intermediária.
3. Transferir indicadores financeiros e regras de integridade para serviços do
   backend quando passarem a orientar decisões críticas.
4. Criar DTOs tipados para ônibus, hotéis e participantes, eliminando os campos
   JSON opacos (`busesJson`, `hotelsJson`, `travelersJson`).
5. Corrigir o nome contratual de `arrecadationGoal` com estratégia de
   compatibilidade/versionamento.
6. Disponibilizar data de associação do viajante para que “recentes” represente
   uma ordenação real.
7. Fazer `GET /users` retornar um DTO seguro que jamais contenha senha.
8. Proteger todos os endpoints de leitura e escrita com autenticação e
   autorização administrativas antes de considerar a API publicável.

Até essas pendências serem resolvidas, as proteções por papel do React continuam
somente visuais, conforme `stage-3-routing-security.md`.
