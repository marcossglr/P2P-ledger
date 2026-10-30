/**
 * Capa centralizada de clientes y llamadas a la API del backend.
 * Unifica el manejo de URLs, headers, parsing de JSON y gestión de errores HTTP.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
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

  return response.json();
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
    return `${API_BASE}/api/operations/export?${query.toString()}`;
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
  getDownloadUrl: (filename) => `${API_BASE}/api/backups/download/${encodeURIComponent(filename)}`,
};
