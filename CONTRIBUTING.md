# Guía de Contribución

¡Gracias por tu interés en contribuir a **P2P Ledger**! Este es un proyecto de código abierto bajo licencia **GPLv3**, diseñado como un terminal financiero y de conciliación desktop-first.

---

## 🛠️ Cómo Empezar

1. **Haz un Fork** del repositorio en GitHub.
2. **Clona tu fork** localmente:
   ```bash
   git clone https://github.com/TU_USUARIO/P2P-ledger.git
   cd P2P-ledger
   ```
3. **Inicia el entorno de desarrollo:**
   ```bash
   ./run.sh
   ```
   * Frontend: `http://localhost:5173`
   * Backend Docs: `http://localhost:8000/docs`

---

## 🧪 Ejecutar Pruebas Automatizadas

Antes de proponer cualquier cambio o enviar un Pull Request, asegúrate de que la suite completa de pruebas pase con éxito:

```bash
./run.sh test
```

Esto ejecutará:
* Pruebas de Backend (Python `unittest`): conciliación, seguridad, inventario bancario.
* Pruebas de Frontend (`Vitest`): formateadores numéricos, fechas y utilidades.

---

## 🎨 Estándares de Diseño y UI

* **Filosofía Desktop-First:** Diseñado como terminal financiero sobrio y de alta densidad para escritorio.
* **Componentes UI centralizados:** Todo nuevo formulario o botón debe consumir los componentes primitivos de `frontend/src/components/ui/` (`Button`, `Input`, `Select`, `Badge`, `Card`, `Modal`).
* **Tipografía numérica:** Los montos, precios y tasas deben usar fuente monoespaciada (`font-mono` / `tabular-nums`).

---

## 📬 Envío de Pull Requests (PRs)

1. Crea una rama descriptiva para tu cambio:
   ```bash
   git checkout -b feature/nuevo-banco-conciliador
   # o
   git checkout -b fix/calculo-tasa-promedio
   ```
2. Realiza commits claros siguiendo la convención [Conventional Commits](https://www.conventionalcommits.org/):
   * `feat: ...` para nuevas funcionalidades.
   * `fix: ...` para corrección de bugs.
   * `docs: ...` para documentación.
   * `test: ...` para adición de pruebas.
3. Asegúrate de que `./run.sh test` pase al 100%.
4. Envía tu Pull Request contra la rama `main`.
