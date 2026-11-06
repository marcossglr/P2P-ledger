# P2P Ledger: Conciliación, Auditoría Financiera y Arbitraje

Plataforma integral y local para comerciantes de arbitraje P2P (Binance y Banca Venezolana). Diseñada para auditar en tiempo real ganancias netas en USDT, monitorear la profundidad de mercado P2P, calcular spreads comerciales efectivos, controlar inventarios bancarios multidivisa y conciliar extractos bancarios contra órdenes de Binance.

---

## ✨ Características Principales

* **Auditoría Financiera y Spreads:**
  * Cálculo de spreads brutos y netos descontando comisiones operativas (Binance P2P y comisiones bancarias como Pago Móvil o débitos IGTF).
  * Desglose detallado de ganancias reales en USDT y balances en VES.
* **Conciliación Automatizada:**
  * Procesamiento inteligente de estados de cuenta bancarios en formato **PDF** (ej. Banesco, Mercantil, Venezuela, etc. vía `pdfplumber`) y archivos **CSV/Excel** exportados de órdenes de Binance.
  * Cruce automático de transacciones por monto, fecha y referencia.
* **Monitor de Mercado P2P en Vivo:**
  * Libro de órdenes y gráfico interactivo de profundidad de mercado (`MarketDepthChart`) para pares fiat/cripto (USDT/VES).
  * Conexión WebSocket y APIs públicas/privadas de Binance.
* **Inventario Bancario y Flujo de Caja:**
  * Gestión centralizada de cuentas bancarias activas, balances disponibles, arqueos y ajustes de saldo.
* **Copias de Seguridad y Mantenimiento:**
  * Exportación y restauración de backups de la base de datos SQLite directamente desde el panel de configuración.

---

## 🚀 Arquitectura y Tecnologías

* **Frontend:**
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
  * [Tailwind CSS](https://tailwindcss.com/) para diseño reactivo y limpio.
  * [Lucide Icons](https://lucide.dev/) y Recharts para visualización de métricas.
* **Backend:**
  * [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) para API REST asíncrona de alto rendimiento.
  * [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://sqlite.org/) para almacenamiento relacional seguro y local.
  * WebSockets y httpx para streaming y consumo de endpoints de Binance.
  * [pdfplumber](https://github.com/jsvine/pdfplumber) para extracción de datos de estados de cuenta.
* **Documentación Matemática:**
  * Consulta [`docs/formulas.md`](./docs/formulas.md) para conocer en profundidad las fórmulas financieras, tasas de comisiones y algoritmos de conciliación.

---

## 📂 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── database.py         # Configuración y sesión SQLite/SQLAlchemy
│   │   ├── models.py           # Modelos de base de datos
│   │   ├── routers/            # Endpoints API (banks, binance, reconciliation, etc.)
│   │   ├── schemas/            # Esquemas de validación Pydantic
│   │   └── services/           # Lógica de negocio (parsers, reconciler, analytics)
│   ├── tests/                  # Pruebas unitarias automatizadas (pytest)
│   └── requirements.txt        # Dependencias de Python
├── frontend/
│   ├── src/
│   │   ├── components/         # Vistas y componentes UI modulares
│   │   ├── services/           # Clientes HTTP hacia la API Backend
│   │   └── utils/              # Funciones auxiliares y formateadores
│   └── package.json            # Dependencias del cliente web
├── docs/
│   └── formulas.md                      # Especificación técnica financiera
├── run.sh                      # Script unificado de inicio de servicios
└── README.md
```

---

## 🛠️ Instalación y Puesta en Marcha

### Prerrequisitos
* **Python 3.10+**
* **Node.js 18+** y **npm**

### Arranque Rápido con `run.sh`
El proyecto incluye un script automatizado que inicia el backend y frontend simultáneamente:

```bash
chmod +x run.sh
./run.sh
```

Una vez levantado:
* **Frontend Web:** `http://localhost:5173`
* **Backend API:** `http://localhost:8000`
* **Documentación Interactiva (Swagger UI):** `http://localhost:8000/docs`

---

### Arranque Manual (Opcional)

Si prefieres ejecutar cada servicio por separado:

#### 1. Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # En Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend:
Si utilizas el entorno virtual integrado del proyecto (`backend/.venv`), `node` y `npm` ya vienen preconfigurados:
```bash
# Activar entorno o incorporar binarios al PATH
export PATH="$(pwd)/backend/.venv/bin:$PATH"

cd frontend
npm install
npm run dev
```

---

## 🧪 Pruebas Automatizadas

El backend cuenta con una suite de pruebas con `pytest` que verifica la consistencia de parsers, cálculos analíticos y reglas de conciliación:

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

---

## 🔒 Privacidad y Seguridad Local

Este proyecto fue concebido bajo el principio de **privacidad absoluta**:
* **100% Local:** No existe telemetría externa. La base de datos SQLite (`p2p_reconciliation.db`) reside únicamente en tu entorno local.
* **Credenciales Protegidas:** Las API Keys de Binance son opcionales y solo se almacenan de forma local en archivos excluidos por `.gitignore`.
* **Respaldos:** Tienes control total para generar o restaurar copias de seguridad de tus datos en cualquier momento.
