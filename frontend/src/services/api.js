/**
 * Capa centralizada de clientes y llamadas a la API del backend.
 * Unifica el manejo de URLs, headers, parsing de JSON y gestión de errores HTTP.
 */
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// Variable mutable para almacenar el puerto dinámico resuelto en Tauri Desktop
let resolvedBackendPort = null;
let portResolutionPromise = null;

// Detección de si la app corre en Tauri Desktop o navegador
export const isTauriDesktop = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke);
};

const getTauriInvoke = () => {
  if (typeof window === 'undefined') return null;
  return window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke || null;
};

/**
 * Resuelve y almacena el puerto efímero asignado por el backend en producción nativa.
 * Realiza comprobación activa contra el endpoint de salud (/api/health)
 * para garantizar que el servidor esté listo para recibir peticiones.
 * NUNCA asume un fallback ciego a 8000 en Tauri Desktop para no enrutar a puertos muertos.
 */
export const resolveBackendPort = async () => {
  if (!isTauriDesktop()) return null;
  if (resolvedBackendPort) return resolvedBackendPort;
  if (portResolutionPromise) return portResolutionPromise;

  portResolutionPromise = (async () => {
    const invoke = getTauriInvoke();
    if (!invoke) return null;

    // Intentar resolver y validar el puerto durante hasta ~15 segundos (60 intentos x 250ms)
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const port = await invoke('get_backend_port');
        if (port && typeof port === 'number') {
          // Comprobar activamente si el backend ya responde en ese puerto
          try {
            const healthUrl = `http://127.0.0.1:${port}/api/health`;
            const checkRes = await universalFetch(healthUrl, { method: 'GET' });
            if (checkRes && checkRes.ok) {
              resolvedBackendPort = port;
              return port;
            }
          } catch {
            // El proceso puede estar iniciando el servidor ASGI; esperar el siguiente tick
          }
        }
      } catch {
        // El descriptor de runtime aún no está disponible o el proceso anterior era stale
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // Si fallan todos los intentos, resetear la promesa para permitir reintentos posteriores sin bloquear la app
    portResolutionPromise = null;
    throw new Error('No se pudo establecer conexión con el motor local de P2P Ledger');
  })();

  return portResolutionPromise;
};

// URL base del backend FastAPI:
// En producción Desktop nativa (Tauri), el backend corre en el puerto efímero dinámicamente resuelto.
// Si se usa Vite dev server o navegador con FastAPI sirviendo la SPA, se usa la variable o ruta relativa.
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (isTauriDesktop()) {
    if (!resolvedBackendPort) {
      throw new Error('El backend local aún no ha inicializado su puerto de comunicación.');
    }
    return `http://127.0.0.1:${resolvedBackendPort}`;
  }
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
  // Asegurar que el puerto dinámico esté resuelto en Desktop antes del primer request si aún no lo está
  if (isTauriDesktop() && !resolvedBackendPort) {
    await resolveBackendPort();
  }

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
  getPaymentMethods: (fiat = 'VES', force = false) => {
    const query = new URLSearchParams({ fiat, ...(force ? { force: 'true' } : {}) });
    return request(`/api/binance/p2p-public/payment-methods?${query.toString()}`);
  },
  getCryptoAssets: (fiat = 'VES', force = false) => {
    const query = new URLSearchParams({ fiat, ...(force ? { force: 'true' } : {}) });
    return request(`/api/binance/p2p-public/crypto-assets?${query.toString()}`);
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
