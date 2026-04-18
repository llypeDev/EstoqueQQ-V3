import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, SupabaseConfig, Order, SyncItem, AuditEntry } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';
const LS_AUDITS = 'stock_audits';
const LS_SYNC_QUEUE = 'stock_sync_queue';

type GenericRow = Record<string, unknown>;

type LpAggregatedItem = {
  sku: string;
  qty: number;
  productName: string;
};

type LpOrderMeta = {
  customerName?: string;
  filial?: string;
  matricula?: string;
  date?: string;
  obs?: string;
  orderNumber?: string;
};

type DeleteOrderRef = {
  id: string;
  orderNumber?: string;
};

export interface LpSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  ignoredItems: number;
  errors: number;
}

const LP_ORDER_ID_FIELDS = ['id', 'order_id', 'lp_order_id', 'uuid', 'uid'];
const LP_ORDER_NUMBER_FIELDS = [
  'ticket_number',
  'ticket',
  'order_number',
  'number',
  'numero_pedido',
  'numero',
  'pedido'
];
const LP_ORDER_CUSTOMER_FIELDS = [
  'customer_name',
  'client_name',
  'customer',
  'nome_cliente',
  'cliente',
  'full_name',
  'nome_completo',
  'name',
  'nome',
  'buyer_name'
];
const LP_ORDER_FILIAL_FIELDS = [
  'filial',
  'segmento',
  'segment',
  'branch',
  'store',
  'store_code',
  'branch_code',
  'filial_nome',
  'filial_name',
  'branch_name',
  'filial_destino'
];
const LP_ORDER_MATRICULA_FIELDS = ['matricula', 'employee_id', 'seller_id', 'user_id'];
const LP_ORDER_DATE_FIELDS = ['order_date', 'date', 'data_pedido', 'created_at', 'createdAt'];
const LP_ORDER_OBS_FIELDS = ['obs', 'observation', 'notes', 'note', 'comentario'];
const LP_ORDER_RAW_FIELDS = ['payload', 'data', 'raw_data', 'raw', 'metadata', 'meta', 'json'];
const LP_ORDER_CUSTOMER_PATHS = [
  ['customer', 'name'],
  ['customer', 'full_name'],
  ['cliente', 'nome'],
  ['client', 'name'],
  ['buyer', 'name'],
  ['destinatario', 'nome'],
  ['dados_cliente', 'nome'],
  ['shipping_address', 'name'],
  ['billing_address', 'name']
];
const LP_ORDER_FILIAL_PATHS = [
  ['filial', 'name'],
  ['filial', 'codigo'],
  ['branch', 'name'],
  ['branch', 'code'],
  ['store', 'name'],
  ['store', 'code'],
  ['unidade', 'nome'],
  ['dados_filial', 'nome']
];

const LP_ITEM_ORDER_ID_FIELDS = ['lp_order_id', 'order_id', 'pedido_id', 'id_order', 'order'];
const LP_ITEM_ORDER_NUMBER_FIELDS = [
  'ticket_number',
  'ticket',
  'order_number',
  'numero_pedido',
  'numero',
  'pedido'
];
const LP_ITEM_SKU_FIELDS = ['sku', 'product_sku', 'variant_sku', 'codigo_sku', 'code'];
const LP_ITEM_QTY_FIELDS = ['quantity', 'qty', 'quantidade', 'requested_qty', 'qtd'];
const LP_ITEM_NAME_FIELDS = ['product_name', 'name', 'nome_produto', 'variant_name'];
const LP_ITEM_CUSTOMER_FIELDS = [...LP_ORDER_CUSTOMER_FIELDS, 'customer', 'client', 'buyer'];
const LP_ITEM_FILIAL_FIELDS = [...LP_ORDER_FILIAL_FIELDS, 'filial_destino_nome', 'branch_destiny'];
const LP_ITEM_MATRICULA_FIELDS = [...LP_ORDER_MATRICULA_FIELDS];
const LP_ITEM_DATE_FIELDS = [...LP_ORDER_DATE_FIELDS];
const LP_ITEM_OBS_FIELDS = [...LP_ORDER_OBS_FIELDS];
const LP_ITEM_RAW_FIELDS = ['payload', 'data', 'raw_data', 'raw', 'metadata', 'meta', 'json', 'order_data'];

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

const isRecord = (value: unknown): value is GenericRow => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getRecordValue = (row: GenericRow, field: string): unknown => {
  if (Object.prototype.hasOwnProperty.call(row, field)) {
    return row[field];
  }

  const normalized = field.toLowerCase();
  const matchingKey = Object.keys(row).find(key => key.toLowerCase() === normalized);
  return matchingKey ? row[matchingKey] : undefined;
};

const parseMaybeJsonRecord = (value: unknown): GenericRow | null => {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null;

  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getFirstFieldValue = (row: GenericRow, fields: string[]): unknown => {
  for (const field of fields) {
    const value = getRecordValue(row, field);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
};

const toText = (value: unknown, fallback: string = ''): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toPositiveInt = (value: unknown, fallback: number = 1): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.round(value);
    return normalized > 0 ? normalized : fallback;
  }

  if (typeof value === 'string') {
    const normalized = Number.parseInt(value.replace(',', '.').trim(), 10);
    if (Number.isFinite(normalized) && normalized > 0) return normalized;
  }

  return fallback;
};

const toLookupKey = (value: unknown): string => {
  return toText(value).trim().toLowerCase();
};

const sanitizeMaybeText = (value: unknown): string => {
  const text = toText(value).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === '-') return '';
  return text;
};

const getPathValue = (input: unknown, path: string[]): unknown => {
  let current: unknown = input;
  for (const segment of path) {
    const asRow = parseMaybeJsonRecord(current);
    if (!asRow) return undefined;

    current = getRecordValue(asRow, segment);
    if (current === undefined || current === null || current === '') return current;
  }

  return current;
};

const extractTextFromSource = (
  source: unknown,
  directFields: string[],
  nestedPaths: string[][] = []
): string => {
  const row = parseMaybeJsonRecord(source);
  if (!row) return '';

  const direct = sanitizeMaybeText(getFirstFieldValue(row, directFields));
  if (direct) return direct;

  for (const path of nestedPaths) {
    const nested = sanitizeMaybeText(getPathValue(row, path));
    if (nested) return nested;
  }

  return '';
};

const extractFieldText = (
  row: GenericRow,
  directFields: string[],
  nestedPaths: string[][] = [],
  rawContainerFields: string[] = []
): string => {
  const current = extractTextFromSource(row, directFields, nestedPaths);
  if (current) return current;

  for (const containerField of rawContainerFields) {
    const container = getFirstFieldValue(row, [containerField]);
    if (Array.isArray(container)) {
      for (const item of container) {
        const fromItem = extractTextFromSource(item, directFields, nestedPaths);
        if (fromItem) return fromItem;
      }
      continue;
    }

    const fromContainer = extractTextFromSource(container, directFields, nestedPaths);
    if (fromContainer) return fromContainer;
  }

  return '';
};

const normalizeOrderDate = (value: unknown): string => {
  const raw = toText(value);
  if (!raw) return new Date().toISOString().slice(0, 10);

  // Already normalized: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Common BR format: DD/MM/YYYY
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
};

const normalizeLocalOrderId = (value: string): string => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || `lp-${Date.now()}`;
};

const serializeOrderForCompare = (order: Order): string => {
  const normalizedItems = [...order.items]
    .map(item => ({
      productId: item.productId,
      productName: item.productName,
      qtyRequested: item.qtyRequested,
      qtyPicked: item.qtyPicked
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  return JSON.stringify({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    filial: order.filial,
    matricula: order.matricula,
    date: order.date,
    status: order.status,
    envioMalote: order.envioMalote === true,
    entregaMatriz: order.entregaMatriz === true,
    obs: order.obs || '',
    items: normalizedItems
  });
};

const getDeleteOrderRef = (input: string | DeleteOrderRef): DeleteOrderRef => {
  if (typeof input === 'string') {
    return { id: input };
  }
  return { id: input.id, orderNumber: input.orderNumber };
};

const deleteByColumnValues = async (
  table: string,
  columns: string[],
  values: unknown[]
): Promise<void> => {
  if (!supabase || columns.length === 0 || values.length === 0) return;

  for (const column of columns) {
    const { error } = await supabase.from(table).delete().in(column, values as any);
    if (error) {
      throw new Error(`${table}.${column}: ${error.message}`);
    }
  }
};

const deleteLpMirrorOrders = async (orderRef: DeleteOrderRef): Promise<void> => {
  if (!supabase) return;

  const orderNumberLookup = toLookupKey(orderRef.orderNumber);
  const localIdLookup = toLookupKey(orderRef.id);
  const localIdWithoutPrefix = localIdLookup.startsWith('lp-') ? localIdLookup.slice(3) : localIdLookup;

  const { data: lpOrdersData, error: lpOrdersError } = await supabase
    .from('lp_orders')
    .select('*')
    .limit(5000);

  if (lpOrdersError) {
    throw new Error(`lp_orders select: ${lpOrdersError.message}`);
  }

  const lpOrders = (lpOrdersData || []) as GenericRow[];
  const lpOrderIds = new Set<unknown>();
  const lpOrderNumbers = new Set<unknown>();

  for (const lpOrder of lpOrders) {
    const rowId = getFirstFieldValue(lpOrder, LP_ORDER_ID_FIELDS);
    const rowNumber = getFirstFieldValue(lpOrder, LP_ORDER_NUMBER_FIELDS);
    const rowIdLookup = toLookupKey(rowId);
    const rowIdNormalized = rowIdLookup ? normalizeLocalOrderId(rowIdLookup) : '';
    const rowNumberLookup = toLookupKey(rowNumber);

    const matchByNumber = Boolean(orderNumberLookup) && rowNumberLookup === orderNumberLookup;
    const matchById = Boolean(localIdWithoutPrefix) && (
      rowIdLookup === localIdWithoutPrefix || rowIdNormalized === localIdWithoutPrefix
    );

    if (matchByNumber || matchById) {
      if (rowId !== undefined && rowId !== null && rowId !== '') lpOrderIds.add(rowId);
      if (rowNumber !== undefined && rowNumber !== null && rowNumber !== '') lpOrderNumbers.add(rowNumber);
    }
  }

  if (orderRef.orderNumber && orderRef.orderNumber.trim()) {
    lpOrderNumbers.add(orderRef.orderNumber.trim());
  }

  if (lpOrders.length > 0) {
    const orderColumns = new Set(Object.keys(lpOrders[0]));
    const lpOrderIdColumns = LP_ORDER_ID_FIELDS.filter(col => orderColumns.has(col));
    const lpOrderNumberColumns = LP_ORDER_NUMBER_FIELDS.filter(col => orderColumns.has(col));

    await deleteByColumnValues('lp_orders', lpOrderIdColumns, Array.from(lpOrderIds));
    await deleteByColumnValues('lp_orders', lpOrderNumberColumns, Array.from(lpOrderNumbers));
  }

  const { data: lpItemsSample, error: lpItemsSampleError } = await supabase
    .from('lp_order_items')
    .select('*')
    .limit(1);

  if (lpItemsSampleError) {
    throw new Error(`lp_order_items select: ${lpItemsSampleError.message}`);
  }

  const sampleItem = (lpItemsSample || [])[0] as GenericRow | undefined;
  if (!sampleItem) return;

  const itemColumns = new Set(Object.keys(sampleItem));
  const lpItemOrderIdColumns = LP_ITEM_ORDER_ID_FIELDS.filter(col => itemColumns.has(col));
  const lpItemOrderNumberColumns = LP_ITEM_ORDER_NUMBER_FIELDS.filter(col => itemColumns.has(col));

  await deleteByColumnValues('lp_order_items', lpItemOrderIdColumns, Array.from(lpOrderIds));
  await deleteByColumnValues('lp_order_items', lpItemOrderNumberColumns, Array.from(lpOrderNumbers));
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
      } else if (item.type === 'AUDIT') {
         await saveAuditEntry(item.payload, true);
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

export const syncLpOrdersToStockOrders = async (stockProductsSeed?: Product[]): Promise<LpSyncResult> => {
  const result: LpSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    ignoredItems: 0,
    errors: 0
  };

  if (!supabase) {
    return result;
  }

  const [lpOrdersRes, lpItemsRes] = await Promise.all([
    supabase.from('lp_orders').select('*').limit(2000),
    supabase.from('lp_order_items').select('*').limit(10000)
  ]);

  if (lpOrdersRes.error) throw new Error(`LP Orders: ${lpOrdersRes.error.message}`);
  if (lpItemsRes.error) throw new Error(`LP Order Items: ${lpItemsRes.error.message}`);

  const lpOrders = (lpOrdersRes.data || []) as GenericRow[];
  const lpItems = (lpItemsRes.data || []) as GenericRow[];

  if (lpOrders.length === 0 || lpItems.length === 0) {
    return result;
  }

  const stockProducts = stockProductsSeed && stockProductsSeed.length > 0
    ? stockProductsSeed
    : await fetchProducts();

  const stockBySku = new Map<string, Product>();
  for (const product of stockProducts) {
    stockBySku.set(toLookupKey(product.id), product);
  }

  const currentOrders = await fetchOrders();
  const currentOrdersById = new Map<string, Order>();
  const currentOrdersByNumber = new Map<string, Order>();
  for (const order of currentOrders) {
    currentOrdersById.set(order.id, order);
    currentOrdersByNumber.set(toLookupKey(order.orderNumber), order);
  }

  const lpItemsByOrderRef = new Map<string, Map<string, LpAggregatedItem>>();
  const lpMetaByOrderRef = new Map<string, LpOrderMeta>();

  const appendLpItem = (
    reference: unknown,
    sku: string,
    qty: number,
    productName: string
  ) => {
    const refKey = toLookupKey(reference);
    if (!refKey) return;

    let bucket = lpItemsByOrderRef.get(refKey);
    if (!bucket) {
      bucket = new Map<string, LpAggregatedItem>();
      lpItemsByOrderRef.set(refKey, bucket);
    }

    const skuKey = toLookupKey(sku);
    const current = bucket.get(skuKey);
    if (current) {
      current.qty += qty;
      if (!current.productName || current.productName.startsWith('SKU ')) {
        current.productName = productName;
      }
      return;
    }

    bucket.set(skuKey, {
      sku,
      qty,
      productName
    });
  };

  const appendOrderMeta = (reference: unknown, meta: LpOrderMeta) => {
    const refKey = toLookupKey(reference);
    if (!refKey) return;

    const current = lpMetaByOrderRef.get(refKey) || {};
    lpMetaByOrderRef.set(refKey, {
      customerName: current.customerName || meta.customerName,
      filial: current.filial || meta.filial,
      matricula: current.matricula || meta.matricula,
      date: current.date || meta.date,
      obs: current.obs || meta.obs,
      orderNumber: current.orderNumber || meta.orderNumber
    });
  };

  for (const rawItem of lpItems) {
    const sku = toText(getFirstFieldValue(rawItem, LP_ITEM_SKU_FIELDS));
    if (!sku) {
      result.ignoredItems += 1;
      continue;
    }

    const qty = toPositiveInt(getFirstFieldValue(rawItem, LP_ITEM_QTY_FIELDS), 1);
    const productName = toText(getFirstFieldValue(rawItem, LP_ITEM_NAME_FIELDS), `SKU ${sku}`);

    const orderIdRef = getFirstFieldValue(rawItem, LP_ITEM_ORDER_ID_FIELDS);
    const orderNumberRef = getFirstFieldValue(rawItem, LP_ITEM_ORDER_NUMBER_FIELDS);
    const hasReference = Boolean(toLookupKey(orderIdRef) || toLookupKey(orderNumberRef));
    if (!hasReference) {
      result.ignoredItems += 1;
      continue;
    }

    appendLpItem(orderIdRef, sku, qty, productName);
    appendLpItem(orderNumberRef, sku, qty, productName);

    const itemMeta: LpOrderMeta = {
      customerName: extractFieldText(rawItem, LP_ITEM_CUSTOMER_FIELDS, LP_ORDER_CUSTOMER_PATHS, LP_ITEM_RAW_FIELDS),
      filial: extractFieldText(rawItem, LP_ITEM_FILIAL_FIELDS, LP_ORDER_FILIAL_PATHS, LP_ITEM_RAW_FIELDS),
      matricula: extractFieldText(rawItem, LP_ITEM_MATRICULA_FIELDS, [], LP_ITEM_RAW_FIELDS),
      date: extractFieldText(rawItem, LP_ITEM_DATE_FIELDS, [], LP_ITEM_RAW_FIELDS),
      obs: extractFieldText(rawItem, LP_ITEM_OBS_FIELDS, [], LP_ITEM_RAW_FIELDS),
      orderNumber: sanitizeMaybeText(orderNumberRef)
    };

    appendOrderMeta(orderIdRef, itemMeta);
    appendOrderMeta(orderNumberRef, itemMeta);
  }

  for (const rawOrder of lpOrders) {
    try {
      const lpOrderId = toText(getFirstFieldValue(rawOrder, LP_ORDER_ID_FIELDS));
      const lpOrderNumber = toText(getFirstFieldValue(rawOrder, LP_ORDER_NUMBER_FIELDS));

      const orderRefCandidates = [
        toLookupKey(lpOrderId),
        toLookupKey(lpOrderNumber)
      ].filter(Boolean);

      if (orderRefCandidates.length === 0) {
        result.skipped += 1;
        continue;
      }

      let lpItemBucket: Map<string, LpAggregatedItem> | undefined;
      for (const ref of orderRefCandidates) {
        lpItemBucket = lpItemsByOrderRef.get(ref);
        if (lpItemBucket && lpItemBucket.size > 0) break;
      }

      if (!lpItemBucket || lpItemBucket.size === 0) {
        result.skipped += 1;
        continue;
      }

      const lpMeta = orderRefCandidates
        .map(ref => lpMetaByOrderRef.get(ref))
        .find(Boolean);

      const normalizedOrderNumber = toLookupKey(lpOrderNumber || lpOrderId);
      const generatedOrderId = `lp-${normalizeLocalOrderId(lpOrderId || lpOrderNumber)}`;
      const existingOrder =
        currentOrdersById.get(generatedOrderId) ||
        currentOrdersByNumber.get(normalizedOrderNumber);

      const existingItemsBySku = new Map<string, { qtyPicked: number; productName: string }>();
      for (const existingItem of existingOrder?.items || []) {
        existingItemsBySku.set(toLookupKey(existingItem.productId), {
          qtyPicked: existingItem.qtyPicked,
          productName: existingItem.productName
        });
      }

      const mappedItems = Array.from(lpItemBucket.values())
        .map((lpItem): { productId: string; productName: string; qtyRequested: number; qtyPicked: number } => {
          const skuKey = toLookupKey(lpItem.sku);
          const stockProduct = stockBySku.get(skuKey);
          const productId = stockProduct?.id || lpItem.sku;
          const previous = existingItemsBySku.get(toLookupKey(productId)) || existingItemsBySku.get(skuKey);
          const qtyRequested = lpItem.qty;
          const qtyPicked = previous ? Math.min(previous.qtyPicked, qtyRequested) : 0;

          return {
            productId,
            productName: stockProduct?.name || lpItem.productName || `SKU ${lpItem.sku}`,
            qtyRequested,
            qtyPicked
          };
        })
        .sort((a, b) => a.productId.localeCompare(b.productId));

      if (mappedItems.length === 0) {
        result.skipped += 1;
        continue;
      }

      const envioMalote = existingOrder?.envioMalote === true;
      const entregaMatriz = existingOrder?.entregaMatriz === true;
      const allPicked = mappedItems.every(i => i.qtyPicked >= i.qtyRequested);
      const hasShipping = envioMalote || entregaMatriz;

      const mappedOrderNumber =
        sanitizeMaybeText(lpOrderNumber) ||
        sanitizeMaybeText(lpMeta?.orderNumber) ||
        sanitizeMaybeText(lpOrderId) ||
        generatedOrderId;

      const mappedCustomerName =
        extractFieldText(rawOrder, LP_ORDER_CUSTOMER_FIELDS, LP_ORDER_CUSTOMER_PATHS, LP_ORDER_RAW_FIELDS) ||
        sanitizeMaybeText(lpMeta?.customerName) ||
        sanitizeMaybeText(existingOrder?.customerName) ||
        'Cliente LP';

      const mappedFilial =
        extractFieldText(rawOrder, LP_ORDER_FILIAL_FIELDS, LP_ORDER_FILIAL_PATHS, LP_ORDER_RAW_FIELDS) ||
        sanitizeMaybeText(lpMeta?.filial) ||
        sanitizeMaybeText(existingOrder?.filial);

      const mappedMatricula =
        extractFieldText(rawOrder, LP_ORDER_MATRICULA_FIELDS, [], LP_ORDER_RAW_FIELDS) ||
        sanitizeMaybeText(lpMeta?.matricula) ||
        sanitizeMaybeText(existingOrder?.matricula);

      const mappedDateRaw =
        extractFieldText(rawOrder, LP_ORDER_DATE_FIELDS, [], LP_ORDER_RAW_FIELDS) ||
        sanitizeMaybeText(lpMeta?.date) ||
        sanitizeMaybeText(existingOrder?.date);

      const mappedObs =
        extractFieldText(rawOrder, LP_ORDER_OBS_FIELDS, [], LP_ORDER_RAW_FIELDS) ||
        sanitizeMaybeText(lpMeta?.obs) ||
        sanitizeMaybeText(existingOrder?.obs) ||
        'Sincronizado automaticamente do LP';

      const mappedOrder: Order = {
        id: existingOrder?.id || generatedOrderId,
        orderNumber: mappedOrderNumber,
        customerName: mappedCustomerName,
        filial: mappedFilial,
        matricula: mappedMatricula,
        date: normalizeOrderDate(mappedDateRaw),
        status: allPicked && hasShipping ? 'completed' : 'pending',
        items: mappedItems,
        obs: mappedObs,
        envioMalote,
        entregaMatriz
      };

      if (existingOrder && serializeOrderForCompare(existingOrder) === serializeOrderForCompare(mappedOrder)) {
        result.skipped += 1;
        continue;
      }

      await saveOrder(mappedOrder, !existingOrder);

      currentOrdersById.set(mappedOrder.id, mappedOrder);
      currentOrdersByNumber.set(toLookupKey(mappedOrder.orderNumber), mappedOrder);

      if (existingOrder) {
        result.updated += 1;
      } else {
        result.imported += 1;
      }
    } catch (error) {
      result.errors += 1;
      console.error('LP sync order error', error);
    }
  }

  return result;
};

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

export const deleteOrder = async (orderInput: string | DeleteOrderRef, skipLocal: boolean = false): Promise<void> => {
    const orderRef = getDeleteOrderRef(orderInput);

    if (supabase) {
        await deleteLpMirrorOrders(orderRef);

        const { error } = await supabase.from('orders').delete().eq('id', orderRef.id);
        if (error) throw new Error(error.message);
    } 
    
    if (!skipLocal) {
        if (!supabase) {
            addToSyncQueue({ type: 'DELETE_ORDER', action: 'DELETE', payload: orderRef, id: orderRef.id });
        }

        const orders = await fetchOrdersFallback();
        const newOrders = orders.filter(o => o.id !== orderRef.id);
        localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
    }
};

// --- AUDIT METHODS ---

export const fetchAuditEntries = async (): Promise<AuditEntry[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('audit_entries')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      return data.map((a: any) => ({
        id: a.id,
        code: a.code,
        productName: a.product_name,
        scannedAt: a.scanned_at
      }));
    }
  }

  const local = localStorage.getItem(LS_AUDITS);
  return local ? JSON.parse(local) : [];
};

const fetchAuditEntriesFallback = async (): Promise<AuditEntry[]> => {
  const local = localStorage.getItem(LS_AUDITS);
  return local ? JSON.parse(local) : [];
};

export const saveAuditEntry = async (entry: AuditEntry, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    const payload = {
      id: entry.id,
      code: entry.code,
      product_name: entry.productName,
      scanned_at: entry.scannedAt
    };

    const { error } = await supabase.from('audit_entries').upsert([payload]);
    if (error) throw new Error(error.message);
  }

  if (!skipLocal) {
    if (!supabase) {
      addToSyncQueue({ type: 'AUDIT', action: 'SAVE', payload: entry, id: entry.id });
    }

    const entries = await fetchAuditEntriesFallback();
    const exists = entries.find(a => a.id === entry.id);
    const next = exists
      ? entries.map(a => (a.id === entry.id ? entry : a))
      : [entry, ...entries];

    localStorage.setItem(LS_AUDITS, JSON.stringify(next));
  }
};
