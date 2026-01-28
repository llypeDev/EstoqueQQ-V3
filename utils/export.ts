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