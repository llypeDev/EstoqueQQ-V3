import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Package, QrCode, ClipboardList, Plus, Search, Settings, 
  Database, Wifi, WifiOff, AlertTriangle, FileText, ArrowRight, Minus, 
  Trash2, Box, History, ArrowDown, ArrowUp, Calendar, ShoppingCart, 
  User, Hash, CheckSquare, Edit, X, RefreshCw, ScanLine, Upload, Truck, Building, CloudUpload
} from 'lucide-react';
import { Product, Movement, ViewState, ToastMessage, Order, OrderItem } from './types';
import * as storage from './services/storage';
import * as exporter from './utils/export';
import Scanner from './components/Scanner';
import QRModal from './components/modals/QRModal';
import Toast from './components/ui/Toast';

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0); // Count of offline items
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals State
  const [showSettings, setShowSettings] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false); // New Import Modal
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<'global' | 'order'>('global');
  
  // Order Modals
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showOrderPicking, setShowOrderPicking] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewQRProduct, setViewQRProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Form States
  const [newProdForm, setNewProdForm] = useState({ id: '', name: '', qty: '' });
  const [baixaForm, setBaixaForm] = useState({ qty: 1, obs: '', matricula: '' });
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out');

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Order Form State
  const emptyOrderForm: Order = {
      id: '',
      orderNumber: '',
      customerName: '',
      filial: '',
      matricula: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      items: [],
      obs: '',
      envioMalote: false,
      entregaMatriz: false
  };
  const [orderForm, setOrderForm] = useState<Order>(emptyOrderForm);
  const [orderItemSearch, setOrderItemSearch] = useState('');

  // --- HELPERS ---
  const addToast = (type: ToastMessage['type'], text: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const prods = await storage.fetchProducts();
      const movs = await storage.fetchMovements();
      const ords = await storage.fetchOrders();
      setProducts(prods);
      setMovements(movs);
      setOrders(ords);
      
      // Check for pending sync items
      setPendingSync(storage.getPendingSyncCount());

    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runSync = useCallback(async () => {
      const count = storage.getPendingSyncCount();
      if (count > 0 && isOnline) {
          addToast('info', `Sincronizando ${count} itens offline...`);
          const result = await storage.processSyncQueue();
          addToast('success', result);
          refreshData(); // Refresh to get server timestamps/IDs if needed
      }
  }, [isOnline, refreshData]);

  // --- EFFECTS ---
  useEffect(() => {
    const online = storage.initSupabase();
    setIsOnline(online);
    refreshData().then(() => {
        // Try to sync on startup if online
        if (online) {
            const count = storage.getPendingSyncCount();
            if(count > 0) {
                 addToast('info', `Enviando ${count} itens pendentes...`);
                 storage.processSyncQueue().then(res => {
                     addToast('success', res);
                     refreshData();
                 });
            }
        }
    });
  }, [refreshData]);

  // --- HANDLERS ---
  
  const handleReconnect = async () => {
    const online = storage.initSupabase();
    setIsOnline(online);
    if(online) {
        addToast('success', 'Conexão restabelecida!');
        await runSync(); // Trigger sync manually
        await refreshData();
        setShowSettings(false);
    } else {
        addToast('error', 'Falha ao conectar. Verifique internet.');
    }
  };

  const handleClearHistory = async () => {
      const message = isOnline 
        ? 'ATENÇÃO: Isso apagará TODO o histórico no Banco de Dados. Tem certeza?' 
        : 'Limpar histórico local?';
      
      if (window.confirm(message)) {
          setIsLoading(true);
          try {
              await storage.deleteAllMovements();
              await refreshData();
              addToast('success', 'Histórico apagado com sucesso.');
          } catch (e: any) {
              console.error("Delete Error:", e);
              addToast('error', 'Erro ao apagar: ' + e.message);
          } finally {
              setIsLoading(false);
          }
      }
  };

  const handleSaveProduct = async () => {
    if (!newProdForm.id || !newProdForm.name) {
      addToast('error', 'Preencha código e nome.');
      return;
    }
    
    setIsLoading(true);
    try {
      const qty = parseInt(newProdForm.qty) || 0;
      await storage.saveProduct({ id: newProdForm.id, name: newProdForm.name, qty }, true);
      await refreshData();
      setShowAddProduct(false);
      setNewProdForm({ id: '', name: '', qty: '' });
      addToast('success', isOnline ? 'Produto salvo!' : 'Salvo offline. Será enviado ao conectar.');
    } catch (e: any) {
      addToast('error', e.message || 'Erro ao salvar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTransaction = async () => {
    if (!selectedProduct) return;
    
    const qtyInput = baixaForm.qty;
    const isRemoval = transactionType === 'out';
    const finalQtyDelta = isRemoval ? -qtyInput : qtyInput;
    
    if (isRemoval && selectedProduct.qty < qtyInput) {
      addToast('error', 'Estoque insuficiente.');
      return;
    }

    if (!baixaForm.matricula.trim()) {
        addToast('error', 'Preencha a matrícula.');
        return;
    }

    setIsLoading(true);
    try {
      const newQty = selectedProduct.qty + finalQtyDelta;
      const updatedProd = { ...selectedProduct, qty: newQty };
      
      // Note: saveProduct will handle offline queue automatically
      await storage.saveProduct(updatedProd, false);
      
      await storage.saveMovement({
        id: Date.now(),
        date: new Date().toISOString(),
        prodId: selectedProduct.id,
        prodName: selectedProduct.name,
        qty: finalQtyDelta, 
        obs: baixaForm.obs,
        matricula: baixaForm.matricula
      });

      await refreshData();
      setShowBaixa(false);
      setSelectedProduct(null);
      setBaixaForm(prev => ({ ...prev, qty: 1, obs: '' })); 
      addToast('success', isOnline ? 'Estoque atualizado!' : 'Salvo offline. Será enviado ao conectar.');
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ORDER HANDLERS ---

  const openNewOrder = () => {
      setOrderForm({
          ...emptyOrderForm,
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      });
      setShowOrderForm(true);
  };

  const openEditOrder = (order: Order) => {
      setOrderForm({ ...order });
      setShowOrderForm(true);
  };

  const openPicking = (order: Order) => {
      setSelectedOrder(order);
      setShowOrderPicking(true);
  };

  const handleSaveOrder = async () => {
      if (!orderForm.orderNumber || !orderForm.customerName) {
          addToast('error', 'Preencha Número e Nome.');
          return;
      }
      if (orderForm.items.length === 0) {
          addToast('error', 'Adicione pelo menos um item.');
          return;
      }

      setIsLoading(true);
      try {
          // Check if editing or new
          const isNew = !orders.find(o => o.id === orderForm.id);
          
          const allPicked = orderForm.items.every(i => i.qtyPicked >= i.qtyRequested);
          const hasShipping = orderForm.envioMalote || orderForm.entregaMatriz;
          const status = (allPicked && hasShipping) ? 'completed' : 'pending';
          
          await storage.saveOrder({ ...orderForm, status }, isNew);
          await refreshData();
          setShowOrderForm(false);
          addToast('success', isOnline ? 'Pedido salvo!' : 'Salvo offline. Será enviado ao conectar.');
      } catch (e: any) {
          addToast('error', 'Erro ao salvar pedido: ' + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const toggleShippingMethod = async (order: Order, method: 'malote' | 'matriz') => {
    setIsLoading(true);
    try {
        const updatedOrder = { ...order };
        
        // Ensure strictly boolean for toggling
        const currentMalote = !!order.envioMalote;
        const currentMatriz = !!order.entregaMatriz;

        if (method === 'malote') {
            updatedOrder.envioMalote = !currentMalote;
        } else {
            updatedOrder.entregaMatriz = !currentMatriz;
        }

        const allPicked = updatedOrder.items.every(i => i.qtyPicked >= i.qtyRequested);
        const hasShipping = (updatedOrder.envioMalote === true) || (updatedOrder.entregaMatriz === true);
        
        const newStatus = (allPicked && hasShipping) ? 'completed' : 'pending';
        updatedOrder.status = newStatus;

        await storage.saveOrder(updatedOrder, false);

        if (newStatus === 'completed' && order.status !== 'completed') {
            const envioLabel = updatedOrder.envioMalote ? 'Malote' : 'Matriz';
            await storage.saveMovement({
                id: Date.now(),
                date: new Date().toISOString(),
                prodId: null, 
                prodName: `Envio Pedido #${updatedOrder.orderNumber}`,
                qty: 0,
                obs: `Pedido Concluído. Via: ${envioLabel}. Filial: ${updatedOrder.filial}`,
                matricula: updatedOrder.matricula
            });
        }

        await refreshData();
        addToast('success', isOnline ? 'Envio atualizado!' : 'Salvo offline.');
    } catch (e: any) {
        console.error("Toggle Error:", e);
        addToast('error', `Erro ao atualizar: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
      if(!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
      setIsLoading(true);
      try {
          await storage.deleteOrder(id);
          await refreshData();
          addToast('success', 'Pedido excluído.');
      } catch (e: any) {
          addToast('error', e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const addProductToOrder = (product: Product) => {
      const existing = orderForm.items.find(i => i.productId === product.id);
      if (existing) {
          const updatedItems = orderForm.items.map(i => 
              i.productId === product.id 
              ? { ...i, qtyRequested: i.qtyRequested + 1 }
              : i
          );
          setOrderForm({ ...orderForm, items: updatedItems });
      } else {
          const newItem: OrderItem = {
              productId: product.id,
              productName: product.name,
              qtyRequested: 1,
              qtyPicked: 0
          };
          setOrderForm({ ...orderForm, items: [...orderForm.items, newItem] });
      }
      addToast('success', 'Item adicionado.');
  };

  const updateOrderItemQty = (prodId: string, newQty: number) => {
      if (newQty <= 0) {
          setOrderForm({ ...orderForm, items: orderForm.items.filter(i => i.productId !== prodId) });
      } else {
          setOrderForm({
              ...orderForm,
              items: orderForm.items.map(i => i.productId === prodId ? { ...i, qtyRequested: newQty } : i)
          });
      }
  };

  const handlePickItem = async (item: OrderItem, silent: boolean = false) => {
      if (!selectedOrder) return;
      if (item.qtyPicked >= item.qtyRequested) {
          if(!silent) addToast('info', 'Item já separado totalmente.');
          return;
      }

      // Verify Stock
      const productInStock = products.find(p => p.id === item.productId);
      if (!productInStock) {
          addToast('error', 'Produto não encontrado no estoque.');
          return;
      }
      if (productInStock.qty <= 0) {
          addToast('error', 'Produto sem estoque!');
          return;
      }

      if(!silent && !window.confirm(`Confirmar baixa de 1x ${item.productName}? Isso descontará do estoque.`)) return;

      setIsLoading(true);
      try {
          // 1. Update Product Stock
          const newQty = productInStock.qty - 1;
          await storage.saveProduct({ ...productInStock, qty: newQty }, false);

          // 2. Create Movement
          await storage.saveMovement({
              id: Date.now(),
              date: new Date().toISOString(),
              prodId: item.productId,
              prodName: item.productName,
              qty: -1,
              obs: `Separação Pedido #${selectedOrder.orderNumber}`,
              matricula: selectedOrder.matricula
          });

          // 3. Update Order Item
          const updatedItems = selectedOrder.items.map(i => 
              i.productId === item.productId 
              ? { ...i, qtyPicked: i.qtyPicked + 1 } 
              : i
          );
          
          const updatedOrder: Order = { 
              ...selectedOrder, 
              items: updatedItems,
              status: 'pending'
          };

          await storage.saveOrder(updatedOrder, false);
          
          // Update Local State
          setSelectedOrder(updatedOrder);
          
          await refreshData(); 
          addToast('success', `Item ${item.productName} baixado.`);

      } catch (e: any) {
          addToast('error', 'Erro na baixa: ' + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  // --- IMPORT HANDLER ---

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target?.result as string;
              if(!text) return;

              setIsLoading(true);
              const lines = text.split('\n');
              const newOrdersMap = new Map<string, Order>();

              // Ignora cabeçalho se houver
              const startIdx = lines[0].toLowerCase().includes('numero') ? 1 : 0;

              for(let i = startIdx; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if(!line) continue;

                  // NOVO FORMATO: Numero;Cliente;Filial;Matricula;Data;CodProduto;Qtd
                  const [num, client, fil, mat, dateStr, prodCode, qtyStr] = line.split(';');
                  
                  if(!num || !prodCode) continue;

                  const qty = parseInt(qtyStr) || 1;
                  
                  // Find Product
                  const prod = products.find(p => p.id === prodCode);
                  const prodName = prod ? prod.name : `Produto ${prodCode}`;

                  // Check if we already started building this order in this loop
                  if(!newOrdersMap.has(num)) {
                      newOrdersMap.set(num, {
                          id: crypto.randomUUID ? crypto.randomUUID() : `IMP-${Date.now()}-${i}`,
                          orderNumber: num,
                          customerName: client || 'Importado',
                          filial: fil || '', // Salva a filial
                          matricula: mat || '',
                          date: dateStr || new Date().toISOString().slice(0,10),
                          status: 'pending',
                          items: [],
                          obs: 'Importado via CSV'
                      });
                  }

                  const order = newOrdersMap.get(num)!;
                  
                  // Check if item exists in order to aggregate
                  const existingItem = order.items.find(it => it.productId === prodCode);
                  if(existingItem) {
                      existingItem.qtyRequested += qty;
                  } else {
                      order.items.push({
                          productId: prodCode,
                          productName: prodName,
                          qtyRequested: qty,
                          qtyPicked: 0
                      });
                  }
              }

              // Save all orders
              for (const order of newOrdersMap.values()) {
                  await storage.saveOrder(order, true);
              }

              await refreshData();
              addToast('success', `${newOrdersMap.size} pedidos importados!`);
              setShowImport(false);
          } catch (err: any) {
              console.error(err);
              addToast('error', 'Erro ao importar CSV.');
          } finally {
              setIsLoading(false);
              // Clear input
              if(fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  // --- GENERAL HANDLERS ---

  const handleScan = (code: string) => {
    setShowScanner(false);

    if (scanMode === 'global') {
        // Global Mode (Check Stock / Transaction)
        const prod = products.find(p => p.id === code);
        if (prod) {
          setSelectedProduct(prod);
          setTransactionType('out'); 
          setBaixaForm(prev => ({ ...prev, qty: 1, obs: '' }));
          setShowBaixa(true);
        } else {
            if(window.confirm(`Produto ${code} não encontrado. Deseja cadastrar?`)) {
                setNewProdForm({ id: code, name: '', qty: '' });
                setShowAddProduct(true);
            }
        }
    } else if (scanMode === 'order' && selectedOrder) {
        // Order Picking Mode
        const item = selectedOrder.items.find(i => i.productId === code);
        
        if (item) {
            handlePickItem(item, true); // Silent = true (skip confirm)
        } else {
            addToast('error', 'Este produto não pertence a este pedido.');
        }
        
        // Reset mode after scan
        setScanMode('global');
    }
  };

  const openOrderScanner = () => {
      setScanMode('order');
      setShowScanner(true);
  };

  const handleManualCodeCheck = () => {
    const code = (document.getElementById('manual-code-input') as HTMLInputElement)?.value;
    if(code) handleScan(code);
  };

  const openTransactionModal = (product: Product) => {
      setSelectedProduct(product);
      setTransactionType('out');
      setBaixaForm({ qty: 1, obs: '', matricula: '' });
      setShowBaixa(true);
  };

  // --- RENDER HELPERS ---
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHistory = movements.filter(m => {
      if (!startDate && !endDate) return true;
      const mDate = new Date(m.date);
      mDate.setHours(0,0,0,0);
      let startValid = true;
      let endValid = true;
      if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0,0,0,0);
          startValid = mDate.getTime() >= sDate.getTime();
      }
      if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(0,0,0,0);
          endValid = mDate.getTime() <= eDate.getTime();
      }
      return startValid && endValid;
  });

  const filteredOrderProducts = products.filter(p => 
    p.name.toLowerCase().includes(orderItemSearch.toLowerCase()) || 
    p.id.toLowerCase().includes(orderItemSearch.toLowerCase())
  );

  return (
    <div className="max-w-[480px] mx-auto bg-slate-50 min-h-screen relative shadow-2xl pb-24">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* --- HEADER --- */}
      <header className="bg-qq-green text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center rounded-b-3xl">
        <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Box size={24} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-tight">Estoque <span className="text-qq-yellow">Palavra</span></h1>
                <div className="flex items-center gap-1.5 opacity-80">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-slate-400'}`}></div>
                    <span className="text-[10px] font-medium tracking-wide uppercase">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            {pendingSync > 0 && !isOnline && (
                 <div className="w-10 h-10 flex items-center justify-center bg-orange-500 rounded-full animate-pulse">
                     <CloudUpload size={18} />
                 </div>
            )}
            <button onClick={refreshData} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition active:scale-95 backdrop-blur-sm">
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowExport(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition active:scale-95 backdrop-blur-sm">
                <FileText size={18} />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition active:scale-95 backdrop-blur-sm">
                <Settings size={18} />
            </button>
        </div>
      </header>

      {/* --- LOADING --- */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-qq-green rounded-full animate-spin"></div>
        </div>
      )}

      {/* --- VIEW: HOME --- */}
      {view === 'home' && (
        <div className="p-6 animate-fade-in space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-slate-800">Produtos</h2>
                <button onClick={() => setShowAddProduct(true)} className="bg-qq-yellow hover:bg-qq-yellow-dark text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-orange-100 transition flex items-center gap-2 active:scale-95">
                    <Plus size={18} /> Novo
                </button>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-qq-green transition-colors" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar nome ou código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-700 focus:outline-none focus:border-qq-green focus:ring-4 focus:ring-qq-green/10 transition-all shadow-sm"
                />
            </div>

            <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <Box size={48} className="mx-auto mb-3 text-slate-400" />
                        <p>Nenhum produto encontrado</p>
                    </div>
                ) : (
                    filteredProducts.map(p => (
                        <div key={p.id} onClick={() => openTransactionModal(p)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-transform cursor-pointer">
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-slate-800 truncate">{p.name}</h3>
                                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-mono">
                                    {p.id}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase mb-0.5 px-1.5 py-0.5 rounded-md inline-block ${p.qty < 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {p.qty < 5 ? 'Baixo' : 'Ok'}
                                    </div>
                                    <div className="text-xl font-bold text-slate-700">{p.qty}</div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewQRProduct(p); }} 
                                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-qq-green transition-colors"
                                >
                                    <QrCode size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {/* --- VIEW: ORDERS --- */}
      {view === 'orders' && (
          <div className="p-6 animate-fade-in space-y-6">
              <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-bold text-slate-800">Pedidos</h2>
                  <button onClick={openNewOrder} className="bg-qq-green hover:bg-qq-green-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-green-100 transition flex items-center gap-2 active:scale-95">
                      <Plus size={18} /> Criar Pedido
                  </button>
              </div>

              <div className="space-y-4">
                  {orders.length === 0 ? (
                      <div className="text-center py-12 opacity-50">
                          <ShoppingCart size={48} className="mx-auto mb-3 text-slate-400" />
                          <p>Nenhum pedido cadastrado</p>
                      </div>
                  ) : (
                      orders.map(order => {
                          const totalItems = order.items.reduce((acc, i) => acc + i.qtyRequested, 0);
                          const pickedItems = order.items.reduce((acc, i) => acc + i.qtyPicked, 0);
                          const progress = totalItems > 0 ? (pickedItems / totalItems) * 100 : 0;
                          const isFullyPicked = totalItems > 0 && pickedItems === totalItems;
                          // Validação visual estrita: Só mostra concluído se tiver flag!
                          const isCompleted = order.status === 'completed' && (order.envioMalote || order.entregaMatriz);

                          return (
                              <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.99] transition-transform relative overflow-hidden">
                                  
                                  {/* Status Banner for Pending Shipment */}
                                  {isFullyPicked && !isCompleted && (
                                      <div className="absolute top-0 right-0 bg-orange-100 text-orange-700 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-xl border-b border-l border-orange-200">
                                          Pendente de Envio
                                      </div>
                                  )}

                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800">#{order.orderNumber}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {isCompleted ? 'Concluído' : (isFullyPicked ? 'Pronto' : 'Pendente')}
                                            </span>
                                          </div>
                                          <p className="text-sm font-medium text-slate-600 truncate max-w-[200px]">{order.customerName}</p>
                                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1 items-center">
                                            <span>{new Date(order.date).toLocaleDateString('pt-BR')}</span>
                                            {order.filial && <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Filial: {order.filial}</span>}
                                            {order.matricula && <span>Mat: {order.matricula}</span>}
                                          </div>
                                          
                                          {/* Logic for Checkboxes: Show only if fully picked */}
                                          {isFullyPicked && (
                                              <div className="flex gap-2 mt-3 pt-2 border-t border-slate-50">
                                                <label className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${order.envioMalote ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={order.envioMalote || false} 
                                                        onChange={() => toggleShippingMethod(order, 'malote')}
                                                        className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500"
                                                    />
                                                    <Truck size={14} /> Malote
                                                </label>
                                                <label className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${order.entregaMatriz ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={order.entregaMatriz || false} 
                                                        onChange={() => toggleShippingMethod(order, 'matriz')}
                                                        className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <Building size={14} /> Matriz
                                                </label>
                                              </div>
                                          )}
                                      </div>
                                      <div className="flex gap-1 flex-col">
                                          <button onClick={() => openEditOrder(order)} className="p-2 text-slate-400 hover:text-qq-green hover:bg-green-50 rounded-lg transition">
                                              <Edit size={18} />
                                          </button>
                                          <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                              <Trash2 size={18} />
                                          </button>
                                      </div>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div onClick={() => openPicking(order)} className="mt-3 cursor-pointer group">
                                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 group-hover:text-qq-green transition-colors">
                                          <span>Separação</span>
                                          <span>{pickedItems}/{totalItems} itens</span>
                                      </div>
                                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                          <div 
                                              className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-qq-green' : 'bg-qq-yellow'}`} 
                                              style={{ width: `${progress}%` }}
                                          ></div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>
      )}

      {/* --- VIEW: SCAN --- */}
      {view === 'scan' && (
        <div className="p-6 animate-fade-in flex flex-col h-[80vh]">
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Ler Código</h2>
            
            <div 
                onClick={() => { setScanMode('global'); setShowScanner(true); }}
                className="flex-1 bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-white/50 cursor-pointer hover:bg-slate-700 transition-colors shadow-inner relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-transparent opacity-50"></div>
                <QrCode size={64} className="mb-4 group-hover:scale-110 transition-transform duration-300 text-white" />
                <p className="font-medium text-white">Toque para abrir a câmera</p>
            </div>

            <div className="mt-8">
                <div className="flex gap-3">
                    <input 
                        id="manual-code-input"
                        type="text" 
                        placeholder="Digitar código..." 
                        className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-slate-700 focus:border-qq-green outline-none"
                    />
                    <button onClick={handleManualCodeCheck} className="bg-qq-green text-white px-5 rounded-xl shadow-lg active:scale-95 transition-transform">
                        <ArrowRight size={24} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- VIEW: HISTORY --- */}
      {view === 'history' && (
        <div className="p-6 animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-slate-800">Histórico</h2>
                <button 
                    onClick={handleClearHistory} 
                    className="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-sm shadow-red-200"
                >
                    <Trash2 size={14} /> Limpar Tudo
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm grid grid-cols-2 gap-3">
                <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar size={12} /> Filtro por Data
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">De:</label>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:border-qq-green outline-none text-slate-700"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Até:</label>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:border-qq-green outline-none text-slate-700"
                    />
                </div>
            </div>

            <div className="space-y-4 pt-2">
                {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <History size={48} className="mx-auto mb-3 text-slate-400" />
                        <p>{movements.length > 0 ? 'Nenhum item neste período' : 'Sem movimentações recentes'}</p>
                    </div>
                ) : (
                    filteredHistory.map(m => (
                        <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                            {/* Icon Logic: Plus/Minus for stock, Truck for Shipping */}
                            {/* Verificamos se é nulo ou ENVIO (legacy) */}
                            {(!m.prodId || m.prodId === 'ENVIO') ? (
                                <div className="mt-1 p-2 rounded-lg bg-blue-50 text-blue-700">
                                    <Truck size={16} />
                                </div>
                            ) : (
                                <div className={`mt-1 p-2 rounded-lg ${m.qty > 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                    {m.qty > 0 ? <Plus size={16} /> : <Minus size={16} />}
                                </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-800 truncate">{m.prodName}</h4>
                                    {m.qty !== 0 && (
                                        <span className={`font-bold ${m.qty > 0 ? 'text-green-600' : 'text-qq-yellow'}`}>
                                            {m.qty > 0 ? `+${m.qty}` : m.qty}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                                    <span>{new Date(m.date).toLocaleString('pt-BR')}</span>
                                    {m.matricula && (
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">Mat: {m.matricula}</span>
                                    )}
                                </div>
                                {m.obs && (
                                    <div className="mt-2 text-xs bg-slate-50 text-slate-600 p-2 rounded italic border border-slate-100">
                                        "{m.obs}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {/* --- BOTTOM NAV --- */}
      <nav className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-slate-100 flex justify-around py-2 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <button onClick={() => setView('home')} className={`flex flex-col items-center p-2 transition-colors ${view === 'home' ? 'text-qq-green' : 'text-slate-400 hover:text-slate-600'}`}>
            <Package size={24} className={view === 'home' ? 'fill-current opacity-20' : ''} />
            <span className="text-[10px] font-bold mt-1">Estoque</span>
        </button>
        
        <button onClick={() => setView('orders')} className={`flex flex-col items-center p-2 transition-colors ${view === 'orders' ? 'text-qq-green' : 'text-slate-400 hover:text-slate-600'}`}>
            <ShoppingCart size={24} className={view === 'orders' ? 'fill-current opacity-20' : ''} />
            <span className="text-[10px] font-bold mt-1">Pedidos</span>
        </button>

        <div className="relative -top-6">
            <button onClick={() => { setScanMode('global'); setView('scan'); }} className="w-16 h-16 rounded-full bg-gradient-to-br from-qq-yellow to-qq-yellow-dark text-white flex items-center justify-center shadow-lg shadow-orange-200 border-4 border-slate-50 transform transition active:scale-90">
                <QrCode size={28} />
            </button>
        </div>

        <button onClick={() => setView('history')} className={`flex flex-col items-center p-2 transition-colors ${view === 'history' ? 'text-qq-green' : 'text-slate-400 hover:text-slate-600'}`}>
            <ClipboardList size={24} className={view === 'history' ? 'fill-current opacity-20' : ''} />
            <span className="text-[10px] font-bold mt-1">Histórico</span>
        </button>

        <button onClick={() => setShowImport(true)} className="flex flex-col items-center p-2 transition-colors text-slate-400 hover:text-slate-600">
            <Upload size={24} />
            <span className="text-[10px] font-bold mt-1">Importar</span>
        </button>
      </nav>

      {/* --- MODALS --- */}
      
      {/* Settings Modal - SIMPLIFICADO PARA SEGURANÇA */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-qq-green/10 p-2 rounded-lg text-qq-green">
                        <Database size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Conexão</h3>
                </div>
                
                <div className="space-y-6">
                    {/* Status da Conexão */}
                    <div className={`p-4 rounded-xl border flex items-center gap-3 ${isOnline ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                         <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                         <div>
                             <p className="font-bold text-slate-800">{isOnline ? 'Conectado' : 'Modo Offline'}</p>
                             <p className="text-xs text-slate-500">{isOnline ? 'Sincronizado com Supabase' : 'Dados salvos localmente'}</p>
                         </div>
                    </div>

                    {pendingSync > 0 && !isOnline && (
                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-3">
                            <CloudUpload className="text-orange-500" size={24} />
                            <div>
                                <p className="font-bold text-orange-700">{pendingSync} itens pendentes</p>
                                <p className="text-xs text-orange-600">Conecte-se para enviar.</p>
                            </div>
                        </div>
                    )}
                    
                    {!isOnline && (
                        <p className="text-xs text-slate-400 text-center">
                            Verifique se as chaves estão configuradas corretamente no código fonte.
                        </p>
                    )}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                    <button onClick={handleReconnect} className="bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Testar Conexão</button>
                    <button onClick={() => setShowSettings(false)} className="bg-qq-green text-white py-3 rounded-xl font-bold hover:bg-qq-green-dark transition">Fechar</button>
                </div>
            </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Novo Produto</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Código (Barras/QR)" value={newProdForm.id} onChange={e => setNewProdForm({...newProdForm, id: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                    <input type="text" placeholder="Nome do Produto" value={newProdForm.name} onChange={e => setNewProdForm({...newProdForm, name: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                    <input type="number" placeholder="Quantidade Inicial" value={newProdForm.qty} onChange={e => setNewProdForm({...newProdForm, qty: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAddProduct(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleSaveProduct} className="flex-1 bg-qq-green text-white py-3 rounded-xl font-bold">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* Create/Edit Order Modal */}
      {showOrderForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {orderForm.orderNumber ? 'Editar Pedido' : 'Novo Pedido'}
                    </h3>
                    <button onClick={() => setShowOrderForm(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                      {/* Headers */}
                      <div className="space-y-3">
                          <div className="flex gap-3">
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nº Pedido</label>
                                  <div className="flex items-center border-2 border-slate-200 rounded-xl p-2 mt-1 focus-within:border-qq-green">
                                      <Hash size={16} className="text-slate-400 mr-2" />
                                      <input type="text" value={orderForm.orderNumber} onChange={e => setOrderForm({...orderForm, orderNumber: e.target.value})} className="w-full outline-none text-sm font-bold" placeholder="001" />
                                  </div>
                              </div>
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Data</label>
                                  <div className="flex items-center border-2 border-slate-200 rounded-xl p-2 mt-1 focus-within:border-qq-green">
                                      <Calendar size={16} className="text-slate-400 mr-2" />
                                      <input type="date" value={orderForm.date} onChange={e => setOrderForm({...orderForm, date: e.target.value})} className="w-full outline-none text-sm" />
                                  </div>
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Cliente / Destino</label>
                              <div className="flex items-center border-2 border-slate-200 rounded-xl p-2 mt-1 focus-within:border-qq-green">
                                  <User size={16} className="text-slate-400 mr-2" />
                                  <input type="text" value={orderForm.customerName} onChange={e => setOrderForm({...orderForm, customerName: e.target.value})} className="w-full outline-none text-sm font-bold" placeholder="Nome..." />
                              </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Filial</label>
                                <input type="text" value={orderForm.filial} onChange={e => setOrderForm({...orderForm, filial: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-2 mt-1 text-sm outline-none focus:border-qq-green" placeholder="01" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Matrícula</label>
                                <input type="text" value={orderForm.matricula} onChange={e => setOrderForm({...orderForm, matricula: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-2 mt-1 text-sm outline-none focus:border-qq-green" placeholder="12345" />
                            </div>
                          </div>
                          
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Observações</label>
                              <input type="text" value={orderForm.obs || ''} onChange={e => setOrderForm({...orderForm, obs: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-2 mt-1 text-sm outline-none focus:border-qq-green" placeholder="Opcional..." />
                          </div>
                      </div>

                      <hr className="border-slate-100" />

                      {/* Items */}
                      <div>
                          <h4 className="font-bold text-slate-700 mb-2">Itens do Pedido</h4>
                          
                          {/* Item Search */}
                          <div className="relative mb-3">
                             <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                             <input 
                                type="text" 
                                placeholder="Buscar produto para adicionar..." 
                                value={orderItemSearch}
                                onChange={e => setOrderItemSearch(e.target.value)}
                                className="w-full pl-9 p-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:border-qq-green"
                             />
                             {orderItemSearch && (
                                 <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-slate-100 rounded-xl mt-1 z-10 max-h-40 overflow-y-auto">
                                     {filteredOrderProducts.map(p => (
                                         <div key={p.id} onClick={() => { addProductToOrder(p); setOrderItemSearch(''); }} className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0">
                                             <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                                             <span className="text-xs bg-slate-100 px-1.5 rounded ml-2">Est: {p.qty}</span>
                                         </div>
                                     ))}
                                 </div>
                             )}
                          </div>

                          {/* Items List */}
                          <div className="space-y-2">
                              {orderForm.items.length === 0 ? (
                                  <p className="text-center text-xs text-slate-400 py-4 italic">Nenhum item adicionado</p>
                              ) : (
                                  orderForm.items.map(item => (
                                      <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                          <div className="flex-1 min-w-0 pr-2">
                                              <p className="text-sm font-bold text-slate-700 truncate">{item.productName}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <button onClick={() => updateOrderItemQty(item.productId, item.qtyRequested - 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-red-50 hover:text-red-500">
                                                <Minus size={12} />
                                              </button>
                                              <span className="text-sm font-bold w-6 text-center">{item.qtyRequested}</span>
                                              <button onClick={() => updateOrderItemQty(item.productId, item.qtyRequested + 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-green-50 hover:text-green-600">
                                                <Plus size={12} />
                                              </button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100">
                      <button onClick={handleSaveOrder} className="w-full bg-qq-green hover:bg-qq-green-dark text-white py-3 rounded-xl font-bold shadow-lg shadow-green-100 transition active:scale-95">
                          Salvar Pedido
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Picking Modal */}
      {showOrderPicking && selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Separação #{selectedOrder.orderNumber}</h3>
                        <p className="text-sm text-slate-500">{selectedOrder.customerName}</p>
                    </div>
                    <button onClick={() => setShowOrderPicking(false)} className="bg-slate-100 p-2 rounded-full text-slate-500"><X size={20}/></button>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 text-xs text-blue-800 flex justify-between items-center">
                      <div>
                        <p className="font-bold flex items-center gap-1"><AlertTriangle size={12}/> Modo Separação:</p>
                        <p>Toque para baixar ou use a câmera.</p>
                      </div>
                      <button 
                        onClick={openOrderScanner}
                        className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                      >
                          <ScanLine size={20} />
                      </button>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-3">
                      {selectedOrder.items.map(item => {
                          const isFullyPicked = item.qtyPicked >= item.qtyRequested;
                          const currentStock = products.find(p => p.id === item.productId)?.qty || 0;

                          return (
                              <div 
                                key={item.productId} 
                                onClick={() => !isFullyPicked && handlePickItem(item)}
                                className={`p-3 rounded-xl border transition-all ${
                                    isFullyPicked 
                                    ? 'bg-green-50 border-green-200 opacity-60' 
                                    : 'bg-white border-slate-200 shadow-sm active:scale-[0.98] cursor-pointer hover:border-qq-green'
                                }`}
                              >
                                  <div className="flex justify-between items-center mb-1">
                                      <p className={`font-bold ${isFullyPicked ? 'text-green-800' : 'text-slate-800'}`}>{item.productName}</p>
                                      {isFullyPicked && <CheckSquare size={18} className="text-green-600" />}
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                      <div className="flex items-center gap-2">
                                          <span className="text-slate-500">Separado:</span>
                                          <span className={`font-mono font-bold ${isFullyPicked ? 'text-green-700' : 'text-slate-800'}`}>
                                              {item.qtyPicked} / {item.qtyRequested}
                                          </span>
                                      </div>
                                      {!isFullyPicked && (
                                          <span className={`text-xs px-2 py-0.5 rounded ${currentStock > 0 ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600 font-bold'}`}>
                                              Estoque: {currentStock}
                                          </span>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  {selectedOrder.status === 'completed' && (
                      <div className="mt-4 p-3 bg-green-100 text-green-800 text-center rounded-xl font-bold border border-green-200">
                          Pedido Finalizado
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Transaction Modal (formerly Baixa) */}
      {showBaixa && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                
                {/* Switcher: Entrada / Saída */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button 
                        onClick={() => setTransactionType('out')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${transactionType === 'out' ? 'bg-white text-qq-yellow shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ArrowDown size={16} /> Saída
                    </button>
                    <button 
                        onClick={() => setTransactionType('in')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${transactionType === 'in' ? 'bg-white text-qq-green shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ArrowUp size={16} /> Entrada
                    </button>
                </div>

                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-800 leading-tight">{selectedProduct.name}</h3>
                    <p className="text-slate-500 font-medium mt-1">Em estoque: <span className="font-bold text-slate-800">{selectedProduct.qty}</span></p>
                </div>

                <div className="flex items-center justify-center gap-4 mb-6">
                    <button onClick={() => setBaixaForm({...baixaForm, qty: Math.max(1, baixaForm.qty - 1)})} className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 font-bold text-xl hover:bg-slate-200 transition"><Minus size={20} className="mx-auto" /></button>
                    <div className={`w-24 h-16 border-2 rounded-2xl flex items-center justify-center ${transactionType === 'in' ? 'border-green-100' : 'border-orange-100'}`}>
                        <input 
                            type="number" 
                            value={baixaForm.qty} 
                            onChange={e => setBaixaForm({...baixaForm, qty: parseInt(e.target.value) || 1})} 
                            className={`w-full text-center text-2xl font-bold outline-none bg-transparent ${transactionType === 'in' ? 'text-qq-green' : 'text-qq-yellow'}`}
                        />
                    </div>
                    <button onClick={() => setBaixaForm({...baixaForm, qty: baixaForm.qty + 1})} className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 font-bold text-xl hover:bg-slate-200 transition"><Plus size={20} className="mx-auto" /></button>
                </div>
                
                <div className="space-y-3">
                    {/* Campo de Matrícula (Acima da observação) */}
                    <input 
                        type="text"
                        placeholder="Matrícula do Funcionário"
                        value={baixaForm.matricula}
                        onChange={e => setBaixaForm({...baixaForm, matricula: e.target.value})}
                        className={`w-full border-2 rounded-xl p-3 text-sm outline-none ${transactionType === 'in' ? 'focus:border-qq-green border-slate-100' : 'focus:border-qq-yellow border-slate-100'}`}
                    />

                    <textarea 
                        placeholder="Observação (Opcional)" 
                        value={baixaForm.obs}
                        onChange={e => setBaixaForm({...baixaForm, obs: e.target.value})}
                        rows={2}
                        className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm outline-none resize-none ${transactionType === 'in' ? 'focus:border-qq-green' : 'focus:border-qq-yellow'}`}
                    ></textarea>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={() => { setShowBaixa(false); setSelectedProduct(null); }} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Cancelar</button>
                    <button 
                        onClick={handleConfirmTransaction} 
                        className={`flex-1 text-white py-3 rounded-xl font-bold shadow-lg transition active:scale-95 ${transactionType === 'in' ? 'bg-qq-green hover:bg-qq-green-dark shadow-green-200' : 'bg-qq-yellow hover:bg-qq-yellow-dark shadow-orange-200 text-slate-900'}`}
                    >
                        {transactionType === 'in' ? 'Adicionar' : 'Baixar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Exportar Dados</h3>
                <div className="space-y-3">
                    <button onClick={() => exporter.exportStockCSV(products)} className="w-full flex items-center p-4 rounded-xl border-2 border-qq-green/20 bg-green-50/50 text-qq-green font-bold hover:bg-green-50 transition">
                        <Package size={24} className="mr-3" />
                        Estoque Atual (.csv)
                    </button>
                    <button onClick={() => exporter.exportMovementsCSV(movements)} className="w-full flex items-center p-4 rounded-xl border-2 border-qq-yellow/20 bg-yellow-50/50 text-yellow-700 font-bold hover:bg-yellow-50 transition">
                        <History size={24} className="mr-3" />
                        Histórico (.csv)
                    </button>
                    <button onClick={() => exporter.exportOrdersCSV(orders)} className="w-full flex items-center p-4 rounded-xl border-2 border-blue-400/20 bg-blue-50/50 text-blue-700 font-bold hover:bg-blue-50 transition">
                        <ShoppingCart size={24} className="mr-3" />
                        Relatório Pedidos (.csv)
                    </button>
                </div>
                <button onClick={() => setShowExport(false)} className="w-full mt-6 bg-slate-100 py-3 rounded-xl font-bold text-slate-600">Fechar</button>
            </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">Importar Pedidos</h3>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 mb-6">
                    <p className="font-bold mb-2">Formato CSV (separado por ;):</p>
                    <code className="block bg-white p-2 rounded border border-slate-200 text-slate-500 mb-2 overflow-x-auto whitespace-nowrap">
                        Numero;Cliente;Filial;Matricula;Data;CodProduto;Qtd
                    </code>
                    <p>Exemplo:</p>
                    <code className="block bg-white p-2 rounded border border-slate-200 text-slate-500 overflow-x-auto whitespace-nowrap">
                        101;João;01;1234;2023-10-25;789101;2
                    </code>
                </div>

                <div className="space-y-4">
                    <input 
                        type="file" 
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleImportCSV}
                        className="hidden"
                        id="csv-upload"
                    />
                    <label 
                        htmlFor="csv-upload"
                        className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-qq-green hover:bg-green-50/50 transition-colors"
                    >
                        <Upload size={32} className="text-slate-400 mb-2" />
                        <span className="text-sm font-bold text-slate-600">Toque para selecionar arquivo</span>
                    </label>
                </div>

                <button onClick={() => setShowImport(false)} className="w-full mt-6 bg-slate-100 py-3 rounded-xl font-bold text-slate-600">Cancelar</button>
            </div>
        </div>
      )}

      {/* Scanner Overlay */}
      {showScanner && (
        <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* QR Code View Modal */}
      {viewQRProduct && (
        <QRModal product={viewQRProduct} onClose={() => setViewQRProduct(null)} />
      )}

    </div>
  );
};

export default App;