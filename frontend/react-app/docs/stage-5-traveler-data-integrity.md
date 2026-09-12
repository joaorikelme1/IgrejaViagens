# Etapa 5 — integridade e limites dos dados do viajante

O Dashboard Viajante consome somente `GET /payments`, `GET /seats` e
`GET /rooms`. A viagem ativa já é fornecida pelo contexto de viagens, cuja
origem é `GET /trips`.

## Filtragem e privacidade

- Pagamentos e assentos são filtrados no adaptador da API pelo CPF da sessão e
  pelo identificador da viagem ativa antes de chegarem aos componentes.
- Quartos são filtrados pela viagem e pela presença do CPF da sessão na lista
  de ocupantes.
- Nenhum objeto do dashboard é persistido em storage. Permanece persistido
  somente o identificador da viagem ativa, conforme definido na Etapa 3.
- O contrato atual de quartos não fornece nomes dos ocupantes. Por isso, os
  companheiros são identificados apenas pelos quatro últimos dígitos do CPF.
  Obter os nomes com segurança depende de um endpoint autenticado e específico
  para o viajante, pendente para as Etapas 9 e 10.

## Tratamento defensivo

- Assentos sem ônibus, número positivo ou piso válido são ignorados e geram um
  aviso visível.
- Assentos duplicados são consolidados. Referências a ônibus inexistentes,
  lugares fora da capacidade atual e atribuições em mais de um ônibus são
  exibidas com aviso, sem impedir a passagem digital.
- Múltiplos pagamentos ou quartos para o mesmo CPF e viagem geram aviso; o
  primeiro registro é exibido para manter o dashboard utilizável.
- Parcelamentos com total igual a zero não geram divisão inválida nem `NaN`.
- Ausência de assento, quarto, pagamento ou campos opcionais da viagem possui
  fallback explícito.

## Pendências de backend e segurança

Os endpoints atuais retornam coleções completas e ainda não aplicam autorização
real por usuário. A filtragem no React limita a exibição, mas não protege os
dados trafegados. A correção exige endpoints autenticados e autorizados por CPF
da sessão nas Etapas 9 e 10; este módulo não deve ser considerado uma fronteira
de segurança até essa modernização.

A impressão usa `window.print()` e estilos próprios para impressão. Isso
preserva o comportamento do legado sem popup, `document.write`, HTML dinâmico
ou uma dependência de geração de PDF. As regras são renderizadas como texto
React, sem `dangerouslySetInnerHTML`.
