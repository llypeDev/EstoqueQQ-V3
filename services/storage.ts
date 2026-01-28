import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, SupabaseConfig, Order, SyncItem } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';
const LS_SYNC_QUEUE = 'stock_sync_queue';

// --- CONFIGURAÇÃO DE CONEXÃO ---
// COLOQUE SUAS CREDENCIAIS AQUI PARA CONEXÃO AUTOMÁTICA
const DEFAULT_URL = 'https://fnhapvoxgqkzokravccd.supabase.co'; 
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGFwdm94Z3Frem9rcmF2Y2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU5ODksImV4cCI6MjA4MDgwMTk4OX0.xmZ4F4Zwc4azBr5niczcD9ct37CnTsPb1IFCTKhZ-Bw'; 

let supabase: SupabaseClient | null = null;

// Initialize Supabase automatically
export const initSupabase = (): boolean => {
  if (DEFAULT_URL && DEFAULT_KEY) {
    try {
      supabase = createClient(DEFAULT_URL, DEFAULT_KEY);
      return true;
    } catch (e) {
      console.error("Failed to init supabase", e);
      return false;
    }
  }
  return false;
};

export const getSupabaseConfig = (): SupabaseConfig => ({
  url: DEFAULT_URL ? 'Configurado no Código' : '',
  key: DEFAULT_KEY ? '******' : ''
});

export const clearSupabaseConfig = () => {
  supabase = null;
};

// --- SYNC QUEUE MANAGEMENT ---

const addToSyncQueue = (item: Omit<SyncItem, 'timestamp'>) => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  const queue: SyncItem[] = queueJson ? JSON.parse(queueJson) : [];
  
  // Adiciona novo item
  queue.push({ ...item, timestamp: Date.now() });
  
  localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(queue));
};

export const getPendingSyncCount = (): number => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  return queueJson ? JSON.parse(queueJson).length : 0;
};

// Processa a fila enviando dados para o Supabase
export const processSyncQueue = async (): Promise<string> => {
  if (!supabase) return 'Offline';

  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  if (!queueJson) return 'Empty';

  const queue: SyncItem[] = JSON.parse(queueJson);
  if (queue.length === 0) return 'Empty';

  let successCount = 0;
  const failedItems: SyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'PRODUCT') {
         await saveProduct(item.payload, item.isNew || false, true); // true = skipLocalSave (force remote)
      } else if (item.type === 'MOVEMENT') {
         await saveMovement(item.payload, true);
      } else if (item.type === 'ORDER') {
         await saveOrder(item.payload, item.isNew || false, true);
      } else if (item.type === 'DELETE_ORDER') {
         await deleteOrder(item.payload, true);
      }
      successCount++;
    } catch (e) {
      console.error("Sync failed for item", item, e);
      // Se falhar, mantemos na fila para tentar depois (ou implementamos lógica de descarte)
      // Por enquanto, vamos manter na fila se for erro de rede, mas descartar se for erro de dados
      // Simplificação: Mantém na fila de falhas
      failedItems.push(item);
    }
  }

  // Atualiza a fila apenas com os itens que falharam
  if (failedItems.length > 0) {
      localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(failedItems));
  } else {
      localStorage.removeItem(LS_SYNC_QUEUE);
  }

  return `Sincronizados ${successCount} itens.`;
};

// --- DATA METHODS ---

export const fetchProducts = async (): Promise<Product[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) {
        return data.map((p: any) => ({
            ...p,
            id: Array.isArray(p.id) ? p.id[0] : p.id
        }));
    }
  }
  const local = localStorage.getItem(LS_PRODUCTS);
  return local ? JSON.parse(local) : [];
};

// Adicionado flag `skipLocal` para evitar loop infinito durante o sync
export const saveProduct = async (product: Product, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    if (isNew) {
      let { error } = await supabase.from('products').insert([product]);
      if (error && error.message && error.message.includes('malformed array literal')) {
          const retryPayload = { ...product, id: [product.id] };
          const retry = await supabase.from('products').insert([retryPayload]);
          if (retry.error) throw new Error(retry.error.message);
      } else if (error) {
          throw new Error(error.message);
      }
    } else {
      // Upsert é mais seguro para sync
      const { error } = await supabase.from('products').upsert(product);
      if (error) throw new Error(error.message);
    }
  } 
  
  if (!skipLocal) {
    // Se não tem supabase (offline), adiciona na fila
    if (!supabase) {
        addToSyncQueue({ type: 'PRODUCT', action: 'SAVE', payload: product, isNew, id: product.id });
    }

    // Sempre salva localmente para UI ficar rápida
    const products = await fetchProductsFallback(); // Função auxiliar para ler do storage
    let newProducts = [...products];
    if (isNew) {
        // Verifica duplicidade apenas se não for sync
        if (!supabase && products.find(p => p.id === product.id)) throw new Error("Produto já existe offline!");
        // Se for sync, pode ser que já exista, então tratamos como update no array local
        if (products.find(p => p.id === product.id)) {
             newProducts = products.map(p => p.id === product.id ? product : p);
        } else {
             newProducts.unshift(product);
        }
    } else {
      newProducts = products.map(p => p.id === product.id ? product : p);
    }
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(newProducts));
  }
};

// Helper para ler local storage sem tentar bater no supabase
const fetchProductsFallback = async (): Promise<Product[]> => {
    const local = localStorage.getItem(LS_PRODUCTS);
    return local ? JSON.parse(local) : [];
};

export const fetchMovements = async (): Promise<Movement[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(200);
    if (!error && data) {
      return data.map((m: any) => {
        let matricula = m.matricula;
        let obs = m.obs;
        const rawProdId = m.prod_id;
        const prodId = Array.isArray(rawProdId) ? (rawProdId[0] || null) : (rawProdId || null);

        if (!matricula && obs && typeof obs === 'string' && obs.startsWith('[Mat:')) {
            const match = obs.match(/^\[Mat: (.+?)\]\s*(.*)$/);
            if (match) {
                matricula = match[1];
                obs = match[2];
            }
        }

        return {
          id: m.id,
          date: m.created_at,
          prodId: prodId,
          prodName: m.prod_name,
          qty: m.qty,
          obs: obs,
          matricula: matricula
        };
      });
    }
  }
  const local = localStorage.getItem(LS_MOVEMENTS);
  return local ? JSON.parse(local) : [];
};

export const saveMovement = async (movement: Movement, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    const obsWithMatricula = movement.matricula 
        ? `[Mat: ${movement.matricula}] ${movement.obs || ''}`.trim() 
        : movement.obs;

    const payload = {
      prod_id: movement.prodId,
      prod_name: movement.prodName,
      qty: movement.qty,
      obs: obsWithMatricula,
      created_at: movement.date 
    };

    let { error } = await supabase.from('movements').insert([payload]);

    if (error && error.message && error.message.includes('malformed array literal')) {
        const retryVal = movement.prodId ? [movement.prodId] : [];
        const retryPayload = { ...payload, prod_id: retryVal };
        const retry = await supabase.from('movements').insert([retryPayload]);
        if (retry.error) throw new Error(retry.error.message);
    } else if (error) {
        throw new Error(error.message);
    }

  } 
  
  if (!skipLocal) {
    if (!supabase) {
        addToSyncQueue({ type: 'MOVEMENT', action: 'SAVE', payload: movement, id: movement.id });
    }

    const movements = await fetchMovementsFallback();
    movements.unshift(movement);
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(movements));
  }
};

const fetchMovementsFallback = async (): Promise<Movement[]> => {
    const local = localStorage.getItem(LS_MOVEMENTS);
    return local ? JSON.parse(local) : [];
};

export const clearLocalHistory = () => {
    localStorage.removeItem(LS_MOVEMENTS);
};

export const deleteAllMovements = async (): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('movements').delete().lte('created_at', '3000-01-01');
        if (error) throw new Error(error.message);
    }
    clearLocalHistory();
};

// --- ORDER METHODS ---

export const fetchOrders = async (): Promise<Order[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (!error && data) {
      return data.map((o: any) => {
        const envioMalote = o.envio_malote === true;
        const entregaMatriz = o.entrega_matriz === true;
        let status = o.status;
        if (status === 'completed' && !envioMalote && !entregaMatriz) status = 'pending';

        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          filial: o.filial || '',
          matricula: o.matricula,
          date: o.date,
          status: status,
          items: o.items || [],
          obs: o.obs,
          envioMalote: envioMalote,
          entregaMatriz: entregaMatriz 
        };
      });
    }
  }
  const local = localStorage.getItem(LS_ORDERS);
  if (local) {
      const orders = JSON.parse(local);
      return orders.map((o: any) => ({
          ...o,
          status: (o.status === 'completed' && !o.envioMalote && !o.entregaMatriz) ? 'pending' : o.status
      }));
  }
  return [];
};

export const saveOrder = async (order: Order, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    const payload = {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      filial: order.filial, 
      matricula: order.matricula,
      date: order.date,
      status: order.status,
      items: order.items,
      obs: order.obs,
      envio_malote: order.envioMalote === true, 
      entrega_matriz: order.entregaMatriz === true
    };

    if (isNew) {
      // Usamos upsert aqui também para evitar conflitos de sync se o ID já existir
      const { error } = await supabase.from('orders').upsert([{ ...payload, id: order.id }]);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
      if (error) throw new Error(error.message);
    }
  } 
  
  if (!skipLocal) {
    if (!supabase) {
        addToSyncQueue({ type: 'ORDER', action: 'SAVE', payload: order, isNew, id: order.id });
    }

    const orders = await fetchOrdersFallback();
    let newOrders = [...orders];
    
    // Logic to update local array
    const exists = newOrders.find(o => o.id === order.id);
    if (exists) {
        newOrders = newOrders.map(o => o.id === order.id ? order : o);
    } else {
        newOrders.unshift(order);
    }
    
    localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
  }
};

const fetchOrdersFallback = async (): Promise<Order[]> => {
    const local = localStorage.getItem(LS_ORDERS);
    return local ? JSON.parse(local) : [];
};

export const deleteOrder = async (id: string, skipLocal: boolean = false): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw new Error(error.message);
    } 
    
    if (!skipLocal) {
        if (!supabase) {
            addToSyncQueue({ type: 'DELETE_ORDER', action: 'DELETE', payload: id, id: id });
        }

        const orders = await fetchOrdersFallback();
        const newOrders = orders.filter(o => o.id !== id);
        localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
    }
};