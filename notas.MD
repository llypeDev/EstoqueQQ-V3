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
- `npx tsc --noEmit` validado sem erros no ambiente de terminal.

## Pendencias Tecnicas Relevantes
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

