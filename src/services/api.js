/**
 * Capa unificada de clientes y llamadas a la API de P2P Ledger.
 * En Tauri Desktop nativo: invoca directamente comandos nativos Rust en memoria (sin HTTP / sin puertos).
 * En navegador web dev: fallback HTTP si se especifica VITE_API_URL.
 */
import { invoke } from '@tauri-apps/api/core';

// Detección de ejecución en entorno Tauri Desktop nativo
export const isTauriDesktop = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke);
};

// ==========================================
// ESTADO Y SALUD DEL SISTEMA
// ==========================================
export const healthApi = {
  check: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_system_health');
    }
    return {
      status: 'healthy',
      mode: 'web_dev',
      stored_orders: 0,
      stored_real_orders: 0,
      stored_demo_orders: 0,
      stored_in_progress_orders: 0,
      binance_api_configured: false,
    };
  },
};

// ==========================================
// BINANCE API & CONFIGURACIÓN
// ==========================================
export const binanceApi = {
  getConfig: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_binance_config');
    }
    return { configured: false, masked_api_key: '' };
  },

  saveConfig: async (apiKey, apiSecret) => {
    if (isTauriDesktop()) {
      return await invoke('save_binance_config', {
        payload: { api_key: apiKey, api_secret: apiSecret },
      });
    }
    return { status: 'saved', configured: true, masked_api_key: 'Configurada' };
  },

  deleteConfig: async () => {
    if (isTauriDesktop()) {
      return await invoke('delete_binance_config');
    }
    return { status: 'deleted', configured: false, masked_api_key: '' };
  },

  getFundingWallet: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_funding_wallet');
    }
    return { asset: 'USDT', free: 0, locked: 0, total: 0, source: 'LOCAL' };
  },

  setFundingWalletManual: async (free, locked) => {
    if (isTauriDesktop()) {
      return await invoke('set_funding_wallet_manual', {
        payload: { free: Number(free) || 0, locked: Number(locked) || 0 },
      });
    }
    return { asset: 'USDT', free, locked, total: (Number(free) || 0) + (Number(locked) || 0) };
  },

  getMyAds: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_my_ads');
    }
    return [];
  },

  getPublicMarketConfig: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_public_market_config');
    }
    return { fiat: 'VES', asset: 'USDT', trade_type: 'BUY', payment_methods: [], rows: 10 };
  },

  savePublicMarketConfig: async (payload) => {
    if (isTauriDesktop()) {
      return await invoke('save_public_market_config', { payload });
    }
    return payload;
  },

  syncOrders: async (payload = {}) => {
    if (isTauriDesktop()) {
      return await invoke('sync_binance_orders', { payload });
    }
    return {
      status: 'synced',
      sync_mode: 'MOCK',
      fetched_count: 0,
      new_orders: 0,
      updated_orders: 0,
      has_in_progress: false,
      in_progress_count: 0,
      last_synced_at: new Date().toLocaleTimeString(),
      period: 'Modo Web Mock',
    };
  },

  testPublicMarketConnection: async () => ({ status: 'ok', latency_ms: 12 }),
  getPublicMarketStats: async (params = {}) => {
    if (isTauriDesktop()) {
      return await invoke('get_public_market_stats', {
        query: {
          asset: params.asset || null,
          fiat: params.fiat || null,
          bank: params.bank || null,
          amount: params.amount ? Number(params.amount) : null,
          only_merchants: Boolean(params.only_merchants),
        },
      });
    }
    return {
      asset: params.asset || 'USDT',
      fiat: params.fiat || 'VES',
      buy: { stats: {}, total_reported: 0, ads: [] },
      sell: { stats: {}, total_reported: 0, ads: [] },
      spread: { absolute: null, percent: null },
      latency_ms: 0,
      fetched_at: new Date().toISOString(),
    };
  },
  getPaymentMethods: async (fiat = 'VES') => {
    if (isTauriDesktop()) {
      return await invoke('get_payment_methods', { fiat });
    }
    return { fiat: fiat || 'VES', total: 0, methods: [] };
  },
  getCryptoAssets: async (fiat = 'VES') => {
    if (isTauriDesktop()) {
      return await invoke('get_crypto_assets', { fiat });
    }
    return {
      fiat: fiat || 'VES',
      total: 5,
      assets: [
        { id: 'USDT', label: 'USDT', name: 'Tether' },
        { id: 'BTC', label: 'BTC', name: 'Bitcoin' },
        { id: 'ETH', label: 'ETH', name: 'Ethereum' },
        { id: 'USDC', label: 'USDC', name: 'USD Coin' },
        { id: 'BNB', label: 'BNB', name: 'BNB' },
      ],
    };
  },
};

// ==========================================
// OPERACIONES P2P & ANALYTICS
// ==========================================
export const operationsApi = {
  getOperations: async (params = {}) => {
    if (isTauriDesktop()) {
      return await invoke('get_operations', {
        params: {
          order_type: params.order_type || null,
          fiat_currency: params.fiat_currency || 'VES',
          search: params.search || null,
        },
      });
    }
    return { orders: [], analytics: {}, total_stored_orders: 0 };
  },

  seedDemo: async () => {
    if (isTauriDesktop()) {
      return await invoke('seed_demo_operations');
    }
    return 0;
  },

  clearOperations: async (onlyDemo = false) => {
    if (isTauriDesktop()) {
      return await invoke('clear_operations', { onlyDemo, only_demo: onlyDemo });
    }
    return 0;
  },

  systemReset: async (payload) => {
    if (isTauriDesktop()) {
      return await invoke('system_reset', { payload });
    }
    return { status: 'success' };
  },

  updatePaymentChannel: async (orderId, paymentChannel) => {
    if (isTauriDesktop()) {
      return await invoke('update_payment_channel', {
        payload: { order_id: Number(orderId), payment_channel: paymentChannel },
      });
    }
  },

  getExportUrl: () => '#',
};

// ==========================================
// INVENTARIO BANCARIO
// ==========================================
export const bankInventoryApi = {
  getInventory: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_bank_inventory');
    }
    return { accounts: [], consolidated: {} };
  },

  getCatalog: async () => [],

  syncBinanceMethods: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_bank_inventory');
    }
  },

  createAccount: async (payload) => {
    if (isTauriDesktop()) {
      return await invoke('create_bank_account', { payload });
    }
  },

  updateAccount: async (accountId, payload) => {
    if (isTauriDesktop()) {
      return await invoke('update_bank_account', {
        accountId: Number(accountId),
        payload,
      });
    }
  },

  deleteAccount: async (accountId) => {
    if (isTauriDesktop()) {
      return await invoke('delete_bank_account', {
        accountId: Number(accountId),
      });
    }
  },

  reconcileAccount: async (payload) => {
    if (isTauriDesktop()) {
      return await invoke('reconcile_bank_account', { payload });
    }
  },

  assignOrder: async (orderId, bankAccountId) => {
    if (isTauriDesktop()) {
      return await invoke('assign_order_to_bank', {
        payload: {
          order_id: Number(orderId),
          bank_account_id: bankAccountId ? Number(bankAccountId) : null,
        },
      });
    }
  },
};

export const reconciliationApi = {
  uploadBinanceCsv: async (formData) => {
    if (isTauriDesktop()) {
      const file = formData.get('file');
      if (!file) throw new Error('No se encontró el archivo CSV en el formulario');
      const text = await file.text();
      return await invoke('import_binance_csv', {
        csvText: text,
        filename: file.name || 'binance_orders.csv',
      });
    }
    return { filename: 'mock.csv', total_rows_raw: 0, valid_rows: 0, new_orders: 0, updated_orders: 0 };
  },
};

export const backupsApi = {
  list: async () => {
    if (isTauriDesktop()) {
      return await invoke('get_backups_list');
    }
    return { status: 'success', current_db_size_bytes: 0, current_db_size_kb: 0, current_db_size_mb: 0, backups: [] };
  },

  create: async () => {
    if (isTauriDesktop()) {
      return await invoke('create_db_backup');
    }
    return { status: 'success', filename: 'backup_mock.db', size_mb: 0.1, message: 'Backup creado' };
  },

  restore: async (filename) => {
    if (isTauriDesktop()) {
      const message = await invoke('restore_db_backup', { filename });
      return { status: 'success', message };
    }
    return { status: 'success', message: 'Restaurado correctamente (modo web)' };
  },

  delete: async (filename) => {
    if (isTauriDesktop()) {
      return await invoke('delete_db_backup', { filename });
    }
  },

  upload: async (formData) => {
    if (isTauriDesktop()) {
      const file = formData.get('file');
      if (!file) throw new Error('No se encontró archivo en el formulario');
      const buffer = await file.arrayBuffer();
      const fileBytes = Array.from(new Uint8Array(buffer));
      return await invoke('upload_db_backup', {
        filename: file.name || 'backup.db',
        fileBytes,
      });
    }
    return { status: 'success', filename: 'backup.db', size_mb: 0.1, message: 'Copia importada' };
  },

  downloadBackup: async (filename) => {
    if (isTauriDesktop()) {
      const bytes = await invoke('export_db_backup', { filename });
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
  },

  getDownloadUrl: (filename) => `#download-${filename}`,
};
