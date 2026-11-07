# P2P Ledger: Terminal Financiero, Conciliación y Arbitraje P2P

Plataforma de escritorio integral y local para comerciantes y mesas de arbitraje P2P (Binance y Banca Venezolana/Multidivisa). Diseñada bajo filosofía **Desktop-First (Terminal Financiero)** para auditar en tiempo real ganancias netas en USDT, monitorear la profundidad de mercado P2P, calcular spreads comerciales efectivos, controlar inventarios bancarios y conciliar extractos bancarios contra órdenes de Binance con privacidad absoluta.

---

## ✨ Características Principales

* **Auditoría Financiera y Spreads:**
  * Cálculo de spreads brutos y netos descontando comisiones operativas (Binance P2P y comisiones bancarias como Pago Móvil o débitos IGTF).
  * Desglose detallado de ganancias reales en USDT, costo promedio ponderado y balances en VES/fiat.
* **Conciliación Automatizada:**
  * Procesamiento inteligente de estados de cuenta bancarios en formato **PDF** (ej. Banesco, Mercantil, Venezuela, etc. vía `pdfplumber`) y archivos **CSV/Excel** exportados de órdenes de Binance.
  * Cruce automático de transacciones por monto, fecha y referencia.
* **Monitor de Mercado P2P en Vivo:**
  * Libro de órdenes y gráfico interactivo de profundidad de mercado para pares fiat/cripto (USDT/VES).
  * Conexión WebSocket y APIs públicas/privadas de Binance con alertas sonoras configurables.
* **Inventario Bancario y Flujo de Caja:**
  * Gestión centralizada de cuentas bancarias activas, balances disponibles, arqueos y ajustes de saldo.
  * Módulo de tesorería y analíticas operativas.
* **Aplicación Nativa de Escritorio (Multiplataforma):**
  * Empaquetado nativo con **Tauri v2** para Linux (`.rpm`, `.deb`, `.AppImage`) y Windows (`.exe`, `.msi`).
  * Soporte de **auto-actualizaciones firmadas** integradas directamente desde la aplicación.
  * Backend Python embebido como proceso *sidecar* con **puerto efímero dinámico** y **watchdog centinela**, garantizando cero colisiones de puertos y liberación limpia de recursos.
* **Copias de Seguridad y Privacidad Local:**
  * Exportación y restauración de backups de la base de datos SQLite directamente desde el panel de configuración.
  * Operación 100% local sin telemetría ni servidores intermedios de terceros.

---

## 🚀 Arquitectura y Tecnologías

* **Escritorio Nativo:**
  * [Tauri v2](https://v2.tauri.app/) (Rust) para empaquetado seguro, integración con el sistema operativo, auto-actualizador y llamadas HTTP de red nativas.
* **Frontend:**
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
  * Sistema centralizado de componentes primitivos (`frontend/src/components/ui/`) bajo diseño compacto, denso y sin barras de scroll forzadas.
  * [Lucide Icons](https://lucide.dev/) y Recharts para analítica financiera.
  * [Vitest](https://vitest.dev/) para pruebas unitarias.
* **Backend:**
  * [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) con [Uvicorn](https://www.uvicorn.org/) para API REST asíncrona de alto rendimiento.
  * [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://sqlite.org/) con WAL mode para persistencia local robusta.
  * [pdfplumber](https://github.com/jsvine/pdfplumber) y pandas para parseo bancario.
  * Empaquetado universal x86-64 con PyInstaller para distribución standalone.
* **Documentación Matemática:**
  * Consulta [`docs/formulas.md`](./docs/formulas.md) para conocer en profundidad las fórmulas financieras, tasas de comisiones y algoritmos de conciliación.

---

## 📂 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── config.py           # Configuración centralizada y rutas de datos del usuario
│   │   ├── database.py         # Configuración y sesión SQLite/SQLAlchemy
│   │   ├── auth.py             # Middleware y utilidades de autenticación
│   │   ├── models.py           # Modelos de base de datos relacional
│   │   ├── routers/            # Endpoints API (banks, binance, reconciliation, operations, etc.)
│   │   ├── schemas/            # Esquemas de validación Pydantic
│   │   └── services/           # Lógica contable (parsers, reconciler, analytics, venezuela_banks)
│   ├── desktop_entry.py        # Punto de entrada para backend sidecar (puerto dinámico + watchdog)
│   ├── tests/                  # Pruebas unitarias backend
│   └── requirements.txt        # Dependencias de Python
├── frontend/
│   ├── src/
│   │   ├── components/         # Vistas modulares (Operations, Treasury, History, Settings, ui/)
│   │   ├── services/           # Clientes HTTP universales y resolución dinámica de backend
│   │   ├── test/               # Pruebas unitarias del frontend (Vitest)
│   │   └── utils/              # Funciones auxiliares y formateadores numéricos
│   ├── src-tauri/              # Configuración y binarios nativos de escritorio (Tauri Rust)
│   │   ├── Cargo.toml          # Dependencias y metadatos de Rust
│   │   ├── tauri.conf.json     # Configuración de ventanas, empaquetado y auto-actualizador
│   │   └── src/main.rs         # Ciclo de vida desktop, migración de datos y comandos IPC
│   └── package.json            # Dependencias del cliente web y scripts
├── scripts/
│   └── bump_version.sh         # Script automatizado de versionado SemVer y tags de release
├── docs/
│   └── formulas.md             # Especificación técnica y fórmulas financieras
├── AGENTS.md                   # Estándares de desarrollo y reglas de interfaz Desktop-First
├── run.sh                      # Script unificado de inicio y testing en desarrollo
└── README.md
```

---

## 💻 Puesta en Marcha (Entorno de Desarrollo)

### Prerrequisitos
* **Python 3.10+**
* **Node.js 18+** y **npm**
* *(Opcional para compilar escritorio localmente)* **Rust** y dependencias nativas de Tauri.

### 1. Variables de Entorno (Opcional)
Copia la plantilla de variables de entorno si deseas personalizar puertos o credenciales de desarrollo:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Entorno de ejecución (`development` o `production`) | `development` |
| `REQUIRE_AUTH` | Habilita autenticación por API Token | `false` |
| `API_SECRET_KEY` | Clave secreta requerida cuando `REQUIRE_AUTH=true` | - |
| `HOST` | Dirección de bind local | `127.0.0.1` |
| `PORT` | Puerto del backend en modo desarrollo | `8000` |
| `FRONTEND_PORT`| Puerto para el servidor de desarrollo Vite | `5173` |

---

### 2. Arranque Rápido con `run.sh`

El proyecto incluye el script [`run.sh`](./run.sh) para iniciar el entorno de desarrollo y pruebas:

#### Modo Desarrollo
Inicia el backend en `8000` con autoreload y el frontend en `5173` con Vite HMR (recarga en caliente) simultáneamente:

```bash
chmod +x run.sh
./run.sh
```
* **Frontend Web:** `http://localhost:5173`
* **Backend API:** `http://localhost:8000`
* **Documentación Interactiva (Swagger UI):** `http://localhost:8000/docs`

---

### 3. Ejecución de Pruebas Automatizadas

```bash
./run.sh test
```
O de forma individual:
* **Backend:** `python -m unittest discover backend/tests`
* **Frontend:** `cd frontend && npm test -- --run`

---

## 📦 Versionado y Nuevos Releases

El proyecto utiliza un flujo de versionado semántico centralizado. Para preparar una nueva versión y sincronizar todos los módulos (`tauri.conf.json`, `Cargo.toml`, `package.json` y `config.py`):

```bash
# Actualizar versión, crear commit y tag git local:
./scripts/bump_version.sh 0.3.8

# O actualizar y enviar directamente a GitHub para disparar el CI/CD:
./scripts/bump_version.sh 0.3.8 --push
```

GitHub Actions compilará automáticamente los instaladores para Linux y Windows y generará el release con las firmas para el auto-actualizador.

---

## 🔒 Privacidad y Almacenamiento Local

* **100% Local:** No existe telemetría externa. La base de datos SQLite reside exclusivamente en el directorio estándar del usuario:
  * **Linux:** `~/.local/share/p2p-ledger/p2p_reconciliation.db`
  * **Windows:** `%APPDATA%/p2p-ledger/p2p_reconciliation.db`
* **Credenciales Protegidas:** Las API Keys de Binance son opcionales y se almacenan de forma local.
* **Copias de Seguridad:** Puedes exportar o restaurar backups completos de tu base de datos en formato `.db` o `.sqlite` desde la vista de Configuración.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **GNU General Public License v3.0 (GPLv3)**. Consulta el archivo [`LICENSE`](./LICENSE) para más detalles.
