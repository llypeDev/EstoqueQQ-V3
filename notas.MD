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

## Pendencias Tecnicas Relevantes
- Executar SQL de auditoria no Supabase:
  - arquivo: `supabase_auditoria.sql`
  - cria tabela `audit_entries` + indice por `scanned_at`
- Revisar `index.html`:
  - ha scripts de bootstrap possivelmente duplicados para `index.tsx`
  - referencia para `/index.css` inexistente no build
- Revisar `sw.js`:
  - cache inclui `./index.tsx` (nao ideal para build de producao)
- Revisar `components/modals/QRModal.tsx`:
  - usa `document.write` na impressao (avaliar sanitizacao/seguranca)
- Revisar `components/Scanner.tsx`:
  - lock de concorrencia de baixa em pedido ja foi aplicado no `App.tsx`
  - avaliar debounce/controle adicional para leituras repetidas em outros modos
- Refatoracao gradual:
  - `App.tsx` esta grande (manutenibilidade)

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
