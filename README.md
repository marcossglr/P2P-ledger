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
  * Módulo de tesorería y analíticas operativas.
* **Copias de Seguridad y Seguridad Local:**
  * Exportación y restauración de backups de la base de datos SQLite directamente desde el panel de configuración.
  * Autenticación opcional vía token/secret key y operación 100% local.

---

## 🚀 Arquitectura y Tecnologías

* **Frontend:**
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
  * [Tailwind CSS](https://tailwindcss.com/) con diseño Desktop-First (terminal financiero sobrio y compacto).
  * [Lucide Icons](https://lucide.dev/) y Recharts para visualización de métricas.
  * [Vitest](https://vitest.dev/) para pruebas unitarias.
* **Backend:**
  * [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) para API REST asíncrona de alto rendimiento.
  * [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://sqlite.org/) para almacenamiento relacional seguro y local.
  * WebSockets y httpx para streaming y consumo de endpoints de Binance.
  * [pdfplumber](https://github.com/jsvine/pdfplumber) para extracción de datos de estados de cuenta.
  * Python `unittest` para suite de pruebas automatizadas.
* **Documentación Matemática:**
  * Consulta [`docs/formulas.md`](./docs/formulas.md) para conocer en profundidad las fórmulas financieras, tasas de comisiones y algoritmos de conciliación.

---

## 📂 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── config.py           # Variables y configuración centralizada
│   │   ├── database.py         # Configuración y sesión SQLite/SQLAlchemy
│   │   ├── auth.py             # Middleware y utilidades de autenticación
│   │   ├── models.py           # Modelos de base de datos
│   │   ├── routers/            # Endpoints API (banks, binance, reconciliation, operations, etc.)
│   │   ├── schemas/            # Esquemas de validación Pydantic
│   │   └── services/           # Lógica de negocio (parsers, reconciler, analytics, venezuela_banks)
│   ├── tests/                  # Pruebas unitarias backend (unittest)
│   └── requirements.txt        # Dependencias de Python
├── frontend/
│   ├── src/
│   │   ├── components/         # Vistas modulares (Dashboard, BankInventory, History, ui/)
│   │   ├── services/           # Clientes HTTP y WebSocket hacia el Backend
│   │   ├── test/               # Pruebas unitarias del frontend (Vitest)
│   │   └── utils/              # Funciones auxiliares y formateadores
│   └── package.json            # Dependencias del cliente web
├── docs/
│   └── formulas.md             # Especificación técnica financiera
├── .env.example                # Plantilla de variables de entorno
├── run.sh                      # Script unificado de inicio y testing
└── README.md
```

---

## 🛠️ Instalación y Puesta en Marcha

### Prerrequisitos
* **Python 3.10+**
* **Node.js 18+** y **npm**

### 1. Configuración de Entorno
Copia la plantilla de variables de entorno y ajusta los valores según tu preferencia (opcional):

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Entorno de ejecución (`development` o `production`) | `development` |
| `REQUIRE_AUTH` | Habilita autenticación por API Token | `false` |
| `API_SECRET_KEY` | Clave secreta requerida cuando `REQUIRE_AUTH=true` | - |
| `HOST` | Dirección de bind local | `127.0.0.1` |
| `PORT` | Puerto del backend / servidor standalone | `8000` |
| `FRONTEND_PORT`| Puerto para el servidor de desarrollo Vite | `5173` |

---

### 2. Arranque Rápido con `run.sh`

El proyecto incluye el script unificado [`run.sh`](./run.sh) con soporte para diferentes modos operativos:

#### Modo Standalone (Producción Local)
Compila automáticamente el frontend si es necesario y sirve toda la aplicación (Frontend estático + API Backend) en un único puerto:

```bash
chmod +x run.sh
./run.sh          # o: ./run.sh app
```
* **Acceso único:** `http://localhost:8000`

#### Modo Desarrollo
Inicia el backend con autoreload y el frontend con Vite HMR (recarga en caliente) simultáneamente:

```bash
./run.sh dev
```
* **Frontend Web:** `http://localhost:5173`
* **Backend API:** `http://localhost:8000`
* **Documentación Interactiva (Swagger UI):** `http://localhost:8000/docs`

---

### 3. Arranque Manual (Opcional)

Si prefieres ejecutar cada servicio en terminales independientes:

#### Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # En Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Pruebas Automatizadas

El proyecto incluye suites de pruebas unitarias tanto para el backend como para el frontend, cubriendo parsers de estados de cuenta, validaciones contables y formateadores inteligentes:

### Ejecutar todas las pruebas (unificado):
```bash
./run.sh test
```

### Ejecutar por separado:
* **Backend:**
  ```bash
  source backend/.venv/bin/activate
  python -m unittest discover backend/tests
  ```
* **Frontend:**
  ```bash
  cd frontend
  npm test -- --run
  ```

---

## 🔒 Privacidad y Seguridad Local

Este proyecto fue concebido bajo el principio de **privacidad absoluta**:
* **100% Local:** No existe telemetría externa. La base de datos SQLite (`p2p_reconciliation.db`) reside únicamente en tu entorno local.
* **Credenciales Protegidas:** Las API Keys de Binance son opcionales y solo se almacenan de forma local en archivos excluidos por `.gitignore`.
* **Respaldos:** Tienes control total para generar o restaurar copias de seguridad de tus datos en cualquier momento desde la interfaz.
