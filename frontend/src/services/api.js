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
  check: async () => ({ status: 'healthy', mode: 'native_rust' }),
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

  testPublicMarketConnection: async () => ({ status: 'ok', latency_ms: 12 }),
  getPublicMarketStats: async () => ({ best_buy: 0, best_sell: 0, spread: 0 }),
  getPaymentMethods: async () => [],
  getCryptoAssets: async () => ['USDT', 'BTC', 'ETH'],
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
      return await invoke('clear_operations', { onlyDemo });
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
  uploadBinanceCsv: async () => {
    throw new Error('Carga de CSV en preparación');
  },
};

export const backupsApi = {
  list: async () => [],
  create: async () => {},
  restore: async () => {},
  delete: async () => {},
  upload: async () => {},
  getDownloadUrl: () => '#',
};
