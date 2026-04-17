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
  - proteger contra leituras repetidas para evitar baixa duplicada
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
