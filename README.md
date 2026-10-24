# Sistema de Conciliación y Auditoría Financiera P2P

Plataforma integral para comerciantes de arbitraje P2P (Binance y Banca Venezolana). Permite auditar en tiempo real tus ganancias reales en USDT, calcular spreads comerciales, auditar comisiones operativas (Binance y Pago Móvil) y conciliar movimientos bancarios contra órdenes de Binance.

---

## 🚀 Arquitectura del Proyecto

* **Backend:** FastAPI (Python), SQLAlchemy, SQLite, Parsers de PDF (pdfplumber) y CSV de Binance.
* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons.
* **Métricas y Reglas:** Consultar [`DOCUMENTACION_CALCULOS_Y_FORMULAS.md`](./DOCUMENTACION_CALCULOS_Y_FORMULAS.md) para detalles matemáticos y auditoría financiera.

---

## 🛠️ Instalación y Puesta en Marcha

### Prerrequisitos
* Python 3.10+
* Node.js 18+ y npm

### Arranque Rápido
El proyecto cuenta con un script automatizado que levanta ambos servicios concurrentemente:

```bash
chmod +x run.sh
./run.sh
```

Esto iniciará:
* **Backend API:** `http://localhost:8000` (Documentación Swagger en `/docs`)
* **Frontend Web:** `http://localhost:5173`

---

## 🔒 Privacidad y Seguridad

Este repositorio ignora por diseño (`.gitignore`):
* Bases de datos locales SQLite (`p2p_reconciliation.db`).
* Archivos con credenciales o llaves API (`.binance_credentials.json`).
* Cachés y archivos temporales.

Cualquier credencial de Binance configurada en la aplicación se almacena únicamente en tu máquina local.
