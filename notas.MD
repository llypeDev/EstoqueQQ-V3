# Notas de Projeto (Memoria Persistente)

Este arquivo serve como contexto rapido para retomar o trabalho em chats novos.
Atualize este arquivo ao concluir blocos importantes.

## Projeto
- Nome: EstoqueQQ-V3
- Stack: React + TypeScript + Vite + Supabase
- Foco: controle de estoque, pedidos, scanner de codigo/QR, modo offline com fila de sync

## Estado Atual
- Dependencias instaladas com `npm install`.
- Tipos de React corrigidos:
  - `@types/react`
  - `@types/react-dom`
- `tsconfig.json` atualizado para incluir:
  - `node`
  - `react`
  - `react-dom`
- `App.tsx` com indentacao padronizada (sem tabs e sem recuo impar).
- Recurso de Auditoria implementado:
  - nova aba `Auditoria`
  - modo de scan `audit`
  - consolidacao por SKU (soma quando bipa o mesmo item)
  - cards com total por SKU e resumo geral
  - pop-up de detalhe por item auditado (nome completo, SKU, quantidade, data/hora, estoque atual)
  - bloco `Tamanho` removido do pop-up por solicitacao
- Fluxo de exclusao de pedido ajustado:
  - ao excluir pedido, as pecas ja baixadas (`qtyPicked`) retornam ao estoque
  - o historico recebe movimentos de estorno por item
  - o historico recebe log de sistema informando que o pedido foi removido
- Botao de engrenagem e modal de conexao com banco removidos da UI (nao visivel ao usuario).
- Persistencia de auditoria implementada em `services/storage.ts`:
  - `fetchAuditEntries`
  - `saveAuditEntry`
  - sync offline/online via fila (`AUDIT`)
- SQL da tabela de auditoria criado em `supabase_auditoria.sql`.
- `npx tsc --noEmit` validado sem erros no ambiente de terminal.
- Correcao de estorno ao excluir pedido:
  - fluxo passou a usar snapshot mais recente de produtos via `storage.fetchProducts()`
  - itens estornados sao consolidados por produto antes de atualizar estoque
  - evita soma incorreta por estado local desatualizado
- Correcao de baixa em separacao de pedidos:
  - adicionado lock de concorrencia (`isPickingRef`) para impedir baixa simultanea
  - baixa agora busca pedido e estoque mais recentes antes de decrementar
  - evita perda de decrementos em bips/cliques rapidos
- Melhorias de pop-up/modal:
  - criado componente reutilizavel `components/ui/ActionModal.tsx`
  - suporte padrao para header, subtitulo, footer, fechar no backdrop e botao fechar
  - fechamento global por tecla `ESC` e lock de scroll do `body` quando modal aberto
  - modais migrados para padrao novo: auditoria, novo produto, transacao, exportar, importar, etiqueta QR
  - modais de pedido e separacao receberam backdrop close e tamanhos mais confortaveis
- `npm run build` validado apos as melhorias de modal.
- Scanner com protecao anti-leitura duplicada:
  - debounce por codigo+modo no `handleScan` (`SCAN_DEBOUNCE_MS = 1000`)
  - cache de leituras recentes com limpeza automatica (`recentScansRef`)
  - modo one-shot no `components/Scanner.tsx` para processar apenas 1 leitura por abertura da camera
- `index.css` criado no projeto:
  - remove warning de `/index.css` ausente no build
  - inclui base global de estilo (`body`, `#root`, `pb-safe`) e ajustes visuais do preview da camera
- `npx tsc --noEmit` e `npm run build` validados apos essas correcoes.
- Finalizacao da auditoria implementada:
  - botao `Finalizar auditoria` adicionado na aba de auditoria
  - pop-up de finalizacao com campos: matricula do auditor, data/hora de inicio e data/hora de fim
  - validacao de periodo (inicio nao pode ser maior que fim)
  - exportacao de resumo completo em arquivo Excel (`.xls`) via `utils/export.ts`
  - nome do arquivo inclui matricula + inicio + fim da auditoria
  - planilha inclui: SKU, produto, tamanho, quantidade bipada, estoque atual, divergencia e ultimo bip
  - metadados no topo da planilha: auditor, periodo, total bipado e total de SKUs
- Integracao de pedidos LP implementada (sincronizacao automatica):
  - rotina `syncLpOrdersToStockOrders` adicionada em `services/storage.ts`
  - leitura de `lp_orders` + `lp_order_items`
  - consolidacao por SKU para montar `items` do pedido
  - criacao/atualizacao idempotente de pedidos na tabela `orders` do app
  - sincronizacao executada no `refreshData` da UI (`App.tsx`)
- Mapeamento de campos LP ajustado para estrutura real do banco:
  - cliente: prioriza `full_name`
  - filial: prioriza `segmento`
  - numero do pedido: prioriza `ticket_number`
  - parser reforcado para fallback em campos alternativos e payload/json quando existir
- Exclusao de pedido com limpeza em espelho LP:
  - `deleteOrder` atualizado para remover tambem em `lp_orders` e `lp_order_items`
  - exclusao usa referencia de `id` e `orderNumber` para aumentar taxa de acerto
- Notificacao de exclusao de pedido refinada:
  - se havia separacao (`qtyPicked > 0`): `Pedido excluido e estoque estornado.`
  - se nao havia separacao: `Pedido excluido sem separacao. Estoque nao alterado.`
- Operacao de reconciliacao de estoque por arquivo `Estoque QQ 18.04.XLS` executada:
  - arquivo identificado como texto UTF-16 tabulado (nao XLS binario)
  - comparacao XLS x `products` realizada por SKU
  - 89 SKUs atualizados com sucesso para as quantidades do arquivo
  - 0 SKUs do XLS sem cadastro
  - 30 SKUs cadastrados e fora do XLS foram zerados por solicitacao
  - relatorios JSON gerados na raiz (apoio operacional, podem ser removidos apos uso)

## Pendencias Tecnicas Relevantes
- Executar SQL de auditoria no Supabase:
  - arquivo: `supabase_auditoria.sql`
  - cria tabela `audit_entries` + indice por `scanned_at`
- Revisar `index.html`:
  - ha scripts de bootstrap possivelmente duplicados para `index.tsx`
- Revisar `sw.js`:
  - cache inclui `./index.tsx` (nao ideal para build de producao)
- Revisar `components/modals/QRModal.tsx`:
  - usa `document.write` na impressao (avaliar sanitizacao/seguranca)
- Revisar `components/Scanner.tsx`:
  - lock de concorrencia de baixa em pedido ja foi aplicado no `App.tsx`
  - debounce global/order/audit e one-shot da camera ja implementados
  - proximo passo opcional: parametrizar janela de debounce por modo via configuracao
- Refatoracao gradual:
  - `App.tsx` esta grande (manutenibilidade)
- Higiene de cadastro:
  - existem SKUs duplicados em `products`: `210842` e `210849`
  - avaliar deduplicacao com regra de negocio (merge de saldo e ajuste de historico)

## Comandos Uteis
- Dev: `npm run dev`
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`

## Fluxo Recomendado em Chat Novo
1. Ler este arquivo primeiro.
2. Rodar `npx tsc --noEmit`.
3. Rodar `npm run build`.
4. Atacar pendencias por prioridade (seguranca, dados, UX).

## Log Curto de Decisoes
- Preferencia por manter mudancas pequenas e verificaveis.
- Correcao de base primeiro (tipos/indentacao), depois hardening (PWA, scanner, impressao).
- Auditoria ficou consolidada por SKU para apoio de inventario.
- Importacao de pedidos foi movida para o topo da aba Pedidos para liberar espaco no menu inferior.
- Exclusao de pedido agora faz estorno de estoque e gera rastreabilidade no historico.
- Configuracao de conexao com banco foi ocultada da interface por decisao de UX.
- Pop-ups de acao foram padronizados com `ActionModal` para melhorar consistencia e usabilidade.
- Fechamento por `ESC` e bloqueio de scroll em overlays melhoraram UX mobile/desktop.
- Scanner agora evita leituras repetidas com debounce + one-shot por sessao de camera.
- `index.css` foi adicionado para estabilizar o build e centralizar estilos base.
- Processo de auditoria agora possui fechamento formal com exportacao de resumo em Excel.
