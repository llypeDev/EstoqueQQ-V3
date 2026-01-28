export interface Product {
  id: string; // Barcode or manual code
  name: string;
  qty: number;
}

export interface Movement {
  id: number;
  date: string; // ISO string
  prodId: string | null; // Pode ser null para logs de sistema (ex: Envio)
  prodName: string;
  qty: number; // Negative for removal, positive for addition
  obs?: string;
  matricula?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  qtyRequested: number;
  qtyPicked: number; // Quantidade já baixada/separada
}

export interface Order {
  id: string; // UUID or timestamp based
  orderNumber: string;
  customerName: string;
  filial: string; // Novo campo Filial
  matricula: string;
  date: string; // Data da compra
  status: 'pending' | 'completed';
  items: OrderItem[];
  obs?: string;
  envioMalote?: boolean;
  entregaMatriz?: boolean;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

export type ViewState = 'home' | 'scan' | 'history' | 'orders';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface SyncItem {
  id: string | number;
  type: 'PRODUCT' | 'MOVEMENT' | 'ORDER' | 'DELETE_ORDER';
  action: 'SAVE' | 'DELETE';
  payload: any;
  isNew?: boolean; // Para produtos e pedidos
  timestamp: number;
}