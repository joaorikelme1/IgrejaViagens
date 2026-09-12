# Etapa 8 — Hotel, Transporte e contratos de compatibilidade

## Fontes atuais

- hotéis e definições de quartos: `trips.hotelsJson`;
- ocupantes e parte dos metadados dos quartos: `GET /rooms`;
- ônibus, pisos e capacidades: `trips.busesJson`;
- ocupação de assentos: `GET /seats`;
- nomes dos viajantes: `GET /users`;
- escritas: `PUT /trips/bulk`, `PUT /rooms/bulk` e `PUT /seats/bulk`.

A camada `operationsApi.ts` relê cada coleção antes da escrita, altera somente
o alvo e preserva campos desconhecidos. A interface atualiza o estado e anuncia
sucesso somente após a resposta confirmar o registro. IDs existentes de hotel,
quarto, ônibus e assento nunca são recalculados durante edição.

Novos IDs deixam de usar índices sequenciais. Eles recebem prefixo contextual e
timestamp para evitar que excluir ou reordenar um item renumere associações.

## Integridade defensiva

O módulo sinaliza quartos duplicados, órfãos, acima da capacidade, ocupantes em
mais de um quarto e CPFs que não pertencem à viagem. A edição não permite reduzir
a capacidade abaixo da ocupação atual.

Em transporte, o campo `floor` de cada assento é respeitado. Isso corrige a
conversão legada que descartava o piso ao reconstruir o mapa. São sinalizados
assentos duplicados, fora da capacidade, ligados a ônibus inexistente, atribuídos
ao lugar do motorista ou ocupados por CPF fora da viagem. A capacidade ou o
número de pisos não pode ser reduzido quando isso descartaria uma atribuição.

## Limites para as Etapas 9/10

Os três endpoints bulk substituem tabelas/coleções inteiras e as operações que
envolvem viagem mais quartos ou assentos não são atômicas. Uma falha entre duas
escritas pode deixar metadados e ocupações temporariamente divergentes. O backend
deve oferecer recursos granulares, transações, versionamento otimista, chaves de
quarto compostas pela viagem/hotel e validações server-side de capacidade,
unicidade e associação.

As proteções atuais por papel e viagem continuam somente visuais. Os endpoints
expõem coleções completas sem autorização real, pendência obrigatória das Etapas
9/10. Nenhum objeto operacional ou dado sensível novo é salvo no storage.
