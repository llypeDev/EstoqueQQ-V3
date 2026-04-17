import { Product, Movement, Order } from "../types";

const downloadCSV = (content: string, fileName: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const downloadBinary = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const sanitizeForFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "na";

const formatDateForFileName = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data_invalida";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface AuditSummaryRow {
  code: string;
  productName: string;
  size: string;
  qty: number;
  stockQty: number | null;
  lastScannedAt: string;
}

export interface AuditExportMeta {
  auditorMatricula: string;
  startedAt: string;
  endedAt: string;
}

export const exportStockCSV = (products: Product[]) => {
  const header = "Codigo;Produto;Qtd\n";
  const rows = products.map(p => `${p.id};${p.name};${p.qty}`).join("\n");
  downloadCSV(header + rows, `estoque_${new Date().toISOString().slice(0,10)}.csv`);
};

export const exportMovementsCSV = (movements: Movement[]) => {
  const header = "Data;Codigo;Produto;Qtd;Obs;Matricula\n";
  const rows = movements.map(m => {
    const date = new Date(m.date).toLocaleDateString();
    // Se prodId for nulo, indicamos 'SISTEMA' ou vazio
    const code = m.prodId || 'SISTEMA';
    return `${date};${code};${m.prodName};${m.qty};${m.obs || ''};${m.matricula || ''}`;
  }).join("\n");
  downloadCSV(header + rows, `historico_${new Date().toISOString().slice(0,10)}.csv`);
};

export const exportOrdersCSV = (orders: Order[]) => {
  const header = "Numero;Data;Cliente;Filial;Matricula;Status;Envio;Itens;Obs\n";
  const rows = orders.map(o => {
    const date = new Date(o.date).toLocaleDateString();
    const envio = o.envioMalote ? 'Malote' : (o.entregaMatriz ? 'Matriz' : 'Pendente');
    
    // Resume os itens em uma string "ProdA(2) | ProdB(1)"
    const itensSummary = o.items.map(i => `${i.productName}(${i.qtyRequested})`).join(' | ');
    
    return `${o.orderNumber};${date};${o.customerName};${o.filial};${o.matricula};${o.status === 'completed' ? 'Concluido' : 'Pendente'};${envio};${itensSummary};${o.obs || ''}`;
  }).join("\n");
  
  downloadCSV(header + rows, `relatorio_pedidos_${new Date().toISOString().slice(0,10)}.csv`);
};

export const exportAuditSummaryExcel = (rows: AuditSummaryRow[], meta: AuditExportMeta) => {
  const startedAt = new Date(meta.startedAt);
  const endedAt = new Date(meta.endedAt);
  const generatedAt = new Date();

  const startedLabel = Number.isNaN(startedAt.getTime()) ? meta.startedAt : startedAt.toLocaleString('pt-BR');
  const endedLabel = Number.isNaN(endedAt.getTime()) ? meta.endedAt : endedAt.toLocaleString('pt-BR');
  const generatedLabel = generatedAt.toLocaleString('pt-BR');

  const totalBips = rows.reduce((acc, row) => acc + row.qty, 0);
  const totalSkus = rows.length;

  const dataRows = rows.map((row) => {
    const lastScanned = new Date(row.lastScannedAt);
    const lastScannedLabel = Number.isNaN(lastScanned.getTime()) ? row.lastScannedAt : lastScanned.toLocaleString('pt-BR');
    const stockLabel = row.stockQty === null ? 'Nao encontrado' : String(row.stockQty);
    const divergenceLabel = row.stockQty === null ? 'N/A' : String(row.qty - row.stockQty);

    return `
      <tr>
        <td>${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.productName)}</td>
        <td>${escapeHtml(row.size || 'Nao informado')}</td>
        <td>${row.qty}</td>
        <td>${escapeHtml(stockLabel)}</td>
        <td>${escapeHtml(divergenceLabel)}</td>
        <td>${escapeHtml(lastScannedLabel)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; }
          .meta td { border: none; padding: 2px 0; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="title">Resumo de Auditoria de Estoque</div>
        <table class="meta">
          <tr><td><strong>Matricula do auditor:</strong> ${escapeHtml(meta.auditorMatricula)}</td></tr>
          <tr><td><strong>Inicio da auditoria:</strong> ${escapeHtml(startedLabel)}</td></tr>
          <tr><td><strong>Fim da auditoria:</strong> ${escapeHtml(endedLabel)}</td></tr>
          <tr><td><strong>Gerado em:</strong> ${escapeHtml(generatedLabel)}</td></tr>
          <tr><td><strong>Total bipado:</strong> ${totalBips}</td></tr>
          <tr><td><strong>SKUs unicos:</strong> ${totalSkus}</td></tr>
        </table>
        <br />
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Tamanho</th>
              <th>Quantidade bipada</th>
              <th>Estoque atual</th>
              <th>Divergencia (bipado - estoque)</th>
              <th>Ultimo bip</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const fileName = [
    "auditoria",
    sanitizeForFileName(meta.auditorMatricula),
    formatDateForFileName(meta.startedAt),
    "ate",
    formatDateForFileName(meta.endedAt)
  ].join("_") + ".xls";

  downloadBinary(html, fileName, "application/vnd.ms-excel;charset=utf-8;");
};
