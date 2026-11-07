/**
 * Capa centralizada de clientes y llamadas a la API del backend.
 * Unifica el manejo de URLs, headers, parsing de JSON y gestión de errores HTTP.
 */
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// Detección de si la app corre en Tauri Desktop o navegador
export const isTauriDesktop = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke);
};

// URL base del backend FastAPI:
// En producción Desktop nativa (Tauri), el backend corre como sidecar en 127.0.0.1:8000.
// Si se usa Vite dev server o navegador con FastAPI sirviendo la SPA, se usa la variable o ruta relativa.
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (isTauriDesktop()) return 'http://127.0.0.1:8000';
  return '';
};

// Cliente de fetch universal (usa el cliente nativo Rust en Tauri Desktop para eludir CORS/WebKit, y fetch estándar en web)
export const universalFetch = async (url, options = {}) => {
  if (isTauriDesktop()) {
    try {
      return await tauriFetch(url, options);
    } catch (e) {
      console.warn('tauriFetch falló, intentando fetch nativo del navegador:', e);
    }
  }
  return await window.fetch(url, options);
};

const API_KEY = import.meta.env.VITE_API_KEY || '';

async function request(endpoint, options = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${endpoint}`;
  const headers = { ...options.headers };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await universalFetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errText = await response.text();
      if (errText) {
        try {
          const errData = JSON.parse(errText);
          if (errData && errData.detail) {
            errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          errorMessage = errText.slice(0, 150);
        }
      }
    } catch {
      // Ignorar fallback a errorMessage genérico
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  // Si la respuesta es un blob o descarga
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/octet-stream') || contentType.includes('application/vnd.openxmlformats')) {
    return response.blob();
  }

  const responseText = await response.text();
  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch (parseErr) {
    console.error('Error parseando JSON de respuesta:', responseText);
    throw new Error('La respuesta del servidor no tiene un formato JSON válido.');
  }
}

export const healthApi = {
  check: () => request('/api/health'),
};

export const binanceApi = {
  getConfig: () => request('/api/binance/config'),
  saveConfig: (apiKey, apiSecret) =>
    request('/api/binance/config', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    }),
  deleteConfig: () => request('/api/binance/config', { method: 'DELETE' }),
  getFundingWallet: () => request('/api/binance/funding-wallet'),
  setFundingWalletManual: (free, locked) =>
    request('/api/binance/funding-wallet/manual', {
      method: 'POST',
      body: JSON.stringify({ free, locked }),
    }),
  getMyAds: () => request('/api/binance/my-ads'),
  syncOrders: (payload) =>
    request('/api/binance/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPublicMarketConfig: () => request('/api/binance/p2p-public/config'),
  savePublicMarketConfig: (payload) =>
    request('/api/binance/p2p-public/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  testPublicMarketConnection: (payload) =>
    request('/api/binance/p2p-public/test', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  getPublicMarketStats: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/api/binance/p2p-public/market-stats?${query.toString()}`);
  },
};

export const operationsApi = {
  getOperations: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/api/operations?${query.toString()}`);
  },
  seedDemo: () => request('/api/operations/demo-seed', { method: 'POST' }),
  clearOperations: (onlyDemo = false) =>
    request(`/api/operations/clear?only_demo=${onlyDemo}`, { method: 'DELETE' }),
  updatePaymentChannel: (orderId, paymentChannel) =>
    request('/api/operations/payment-channel', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, payment_channel: paymentChannel }),
    }),
  getExportUrl: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return `${getApiBaseUrl()}/api/operations/export?${query.toString()}`;
  },
};

export const bankInventoryApi = {
  getCatalog: () => request('/api/banks/catalog'),
  getInventory: () => request('/api/bank-inventory'),
  syncBinanceMethods: () => request('/api/bank-inventory/sync-binance-methods', { method: 'POST' }),
  createAccount: (payload) =>
    request('/api/bank-inventory/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAccount: (accountId, payload) =>
    request(`/api/bank-inventory/accounts/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAccount: (accountId) =>
    request(`/api/bank-inventory/accounts/${accountId}`, { method: 'DELETE' }),
  reconcileAccount: (payload) =>
    request('/api/bank-inventory/reconcile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reconcileBulk: (payload) =>
    request('/api/bank-inventory/reconcile-bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  assignOrder: (orderId, bankAccountId) =>
    request('/api/bank-inventory/assign-order', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, bank_account_id: bankAccountId }),
    }),
};

export const reconciliationApi = {
  uploadBinanceCsv: (formData) =>
    request('/api/upload/binance-csv', {
      method: 'POST',
      body: formData,
    }),
  uploadBankPdf: (formData) =>
    request('/api/upload/bank-pdf', {
      method: 'POST',
      body: formData,
    }),
  reconcileWithBank: (toleranceDays = 2) =>
    request(`/api/reconcile?tolerance_days=${toleranceDays}`, { method: 'POST' }),
  manualMatch: (orderId, bankId) =>
    request('/api/reconcile/manual', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, bank_id: bankId }),
    }),
};

export const backupsApi = {
  list: () => request('/api/backups'),
  create: () => request('/api/backups/create', { method: 'POST' }),
  restore: (filename) =>
    request('/api/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),
  delete: (filename) =>
    request(`/api/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  upload: (formData) =>
    request('/api/backups/upload', {
      method: 'POST',
      body: formData,
    }),
  getDownloadUrl: (filename) => `${getApiBaseUrl()}/api/backups/download/${encodeURIComponent(filename)}`,
};
