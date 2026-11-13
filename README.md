# P2P Ledger: Terminal Financiero, Arqueo de Saldos y Arbitraje P2P

Plataforma de escritorio integral y local para comerciantes y mesas de arbitraje P2P (Binance y Banca Venezolana/Multidivisa). Diseñada bajo filosofía **Desktop-First (Terminal Financiero)** para auditar en tiempo real ganancias netas en USDT, monitorear la profundidad de mercado P2P, calcular spreads comerciales efectivos, controlar inventarios bancarios mediante puntos de anclaje de saldo y sincronizar órdenes con total privacidad.

---

## ✨ Características Principales

* **Auditoría Financiera y Spreads:**
  * Cálculo de spreads brutos y netos descontando comisiones operativas (Binance P2P y comisiones bancarias interbancarias / Pago Móvil del 0.3% con piso mínimo de 14 VES).
  * Desglose detallado de ganancias reales en USDT, costo promedio ponderado (WAC/WAP) y balances en VES/fiat.
* **Control de Inventario y Arqueos Bancarios:**
  * Arqueos de saldos en tiempo real mediante **Puntos de Anclaje** (corte base) y marcas de tiempo neutras Epoch UTC.
  * Conciliación automática de flujo de caja: las compras y ventas posteriores al arqueo actualizan el saldo calculado al centavo.
  * Detección inteligente de canal bancario (Mismo Banco = 0% vs Pago Móvil / Interbancario = 0.3% min 14 VES) con soporte para corregir incidencias operativas.
* **Integración con Binance:**
  * Conexión privada con auto-sintonización horaria dinámica contra el reloj de Binance.
  * Reintentos inteligentes con respeto de rate limits.
  * Importación manual de órdenes vía CSV oficial de Binance P2P.
* **Monitor de Mercado P2P en Vivo:**
  * Libro de órdenes y gráfico interactivo de profundidad de mercado para pares fiat/cripto (USDT/VES).
* **Aplicación Nativa de Escritorio (Multiplataforma):**
  * Empaquetado nativo ultra-ligero con **Tauri v2** para Linux (`.rpm`, `.deb`, `.AppImage`) y Windows (`.exe`, `.msi`).
  * Backend y base de datos relacional SQLite integrados de forma nativa en **Rust**, eliminando intérpretes externos, problemas de puertos o empaquetadores frágiles.
  * Soporte de **auto-actualizaciones firmadas** integradas directamente desde la aplicación.
* **Privacidad e Integridad Local:**
  * Base de datos SQLite embebida con soporte WAL (Write-Ahead Logging).
  * Operación 100% local sin telemetría ni servidores intermedios de terceros.

---

## 🚀 Arquitectura y Tecnologías

* **Núcleo de Escritorio y Backend (Rust Nativo):**
  * [Tauri v2](https://v2.tauri.app/) (Rust) para ciclo de vida de la aplicación, ventanas nativas y llamadas seguras de red.
  * [rusqlite](https://github.com/rusqlite/rusqlite) para persistencia relacional SQLite embebida de alta velocidad y concurrencia.
  * Comunicación frontend-backend mediante IPC (In-Process Communication) en memoria, sin sobrecarga HTTP ni colisiones de puertos.
* **Frontend:**
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
  * Sistema centralizado de componentes primitivos (`src/components/ui/`) bajo diseño compacto, denso y sin barras de scroll forzadas.
  * [Lucide Icons](https://lucide.dev/) y Recharts para analítica financiera.
  * [Vitest](https://vitest.dev/) para pruebas unitarias.
* **Documentación Matemática y Financiera Integrada:**
  * Accesible directamente desde la interfaz del sistema en la sección de **Configuración > Documentación del Sistema**, detallando las fórmulas de Costo Promedio Ponderado (WAC), Precio Ponderado de Venta (WAP), comisiones interbancarias y P&L de ciclo cerrado.

---

## 📂 Estructura del Proyecto

```text
.
├── src/                        # Interfaz React
│   ├── components/             # Vistas modulares (Operations, Treasury, History, Settings, ui/)
│   ├── services/               # Clientes Tauri IPC para invocación de comandos Rust
│   ├── test/                   # Pruebas unitarias del frontend (Vitest)
│   └── utils/                  # Funciones auxiliares y formateadores numéricos
├── src-tauri/                  # Backend nativo y configuración de escritorio (Tauri Rust)
│   ├── Cargo.toml              # Dependencias y metadatos de Rust
│   ├── tauri.conf.json         # Configuración de ventanas, paquetes y auto-actualizador
│   └── src/
│       ├── main.rs             # Punto de entrada Tauri y registro de comandos IPC
│       ├── db/                 # Conexión SQLite embebida y migraciones automáticas
│       ├── services/           # Lógica financiera (inventario bancario, analítica, Binance, backups)
│       └── commands/           # Handlers de comandos Tauri expuestos al frontend
├── package.json                # Dependencias del cliente web y scripts
├── scripts/
│   └── bump_version.sh         # Script automatizado de versionado SemVer y tags de release
├── AGENTS.md                   # Estándares de desarrollo y reglas de interfaz Desktop-First
├── run.sh                      # Script unificado de inicio, empaquetado y pruebas
└── README.md
```

---

## 💻 Puesta en Marcha (Entorno de Desarrollo)

### Prerrequisitos

* **Node.js 18+** y **npm**
* **Rust 1.77+** y **Cargo**
* **Librerías de desarrollo C/WebKit en Linux (Fedora/RHEL):**
  ```bash
  sudo dnf install webkit2gtk4.1-devel glib2-devel libappindicator-gtk3-devel librsvg2-devel
  ```
  *(En Ubuntu/Debian: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev`)*

---

### Arranque Rápido con `run.sh`

El proyecto incluye el script [`run.sh`](./run.sh) como controlador central:

#### 1. Modo Desarrollo
Inicia la aplicación de escritorio nativa con recarga en caliente (HMR) tanto en la interfaz web como en el backend Rust:

```bash
chmod +x run.sh
./run.sh
# o explícitamente:
./run.sh dev
```

#### 2. Compilar para Producción
Genera el paquete ejecutable nativo según tu sistema operativo (`.rpm` en Fedora, `.deb` en Ubuntu, o binario en `.AppImage`):

```bash
./run.sh build
```
Los archivos compilados se encontrarán en `src-tauri/target/release/bundle/`.

#### 3. Ejecutar Pruebas Automatizadas
Ejecuta la suite de pruebas del backend en Rust y del frontend en Vitest:

```bash
./run.sh test
```

---

## 📦 Versionado y Nuevos Releases

El proyecto utiliza un flujo de versionado semántico centralizado. Para preparar una nueva versión y sincronizar los módulos (`tauri.conf.json`, `Cargo.toml` y `package.json`):

```bash
# Actualizar versión, crear commit y tag git local:
./scripts/bump_version.sh 0.3.9

# O actualizar y enviar directamente a GitHub para disparar el CI/CD:
./scripts/bump_version.sh 0.3.9 --push
```

GitHub Actions compilará automáticamente los instaladores para Linux y Windows y generará el release con las firmas para el auto-actualizador.

---

## 🔒 Privacidad y Almacenamiento Local

* **100% Local:** No existe telemetría externa. La base de datos SQLite reside exclusivamente en el directorio estándar del usuario:
  * **Linux:** `~/.local/share/p2p-ledger/p2p_ledger.db`
  * **Windows:** `%APPDATA%/p2p-ledger/p2p_ledger.db`
* **Credenciales Protegidas:** Las credenciales de Binance se almacenan exclusivamente en la base de datos SQLite local de forma cifrada/privada.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **GNU General Public License v3.0 (GPLv3)**. Consulta el archivo [`LICENSE`](./LICENSE) para más detalles.
