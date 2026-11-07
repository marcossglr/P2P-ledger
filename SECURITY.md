# Política de Seguridad

Nos tomamos muy en serio la seguridad y la privacidad de los operadores que utilizan **P2P Ledger**. Al tratarse de un terminal financiero local que maneja información contable y credenciales, la divulgación responsable de vulnerabilidades es fundamental.

---

## 🔒 Reportar una Vulnerabilidad

Si descubres una vulnerabilidad de seguridad o un posible vector de fuga de información, te pedimos que **NO abras un Issue público** en GitHub.

Por favor, reporta el hallazgo de manera privada siguiendo estos pasos:

1. Envía un correo electrónico directamente a:  
   📧 **marcossglr@gmail.com**
2. Incluye en el asunto: `[Vulnerabilidad de Seguridad] P2P Ledger - Breve descripción`.
3. Detalla en el mensaje:
   * Tipo de problema (ej. Path traversal, debilidad en autenticación, fuga de tokens, etc.).
   * Pasos claros para reproducir el fallo (proof of concept o instrucciones).
   * Impacto potencial estimado sobre el usuario o sus fondos/datos.

---

## 🛡️ Compromiso de Respuesta

* **Recepción:** Recibirás una confirmación de recepción en un plazo máximo de **48 horas**.
* **Evaluación y Parche:** Se evaluará la severidad y se preparará un parche correctivo antes de hacer público cualquier detalle.
* **Agradecimiento:** Si lo deseas, tu nombre o alias será reconocido en las notas de la release correctiva.

---

## 🛠️ Buenas Prácticas y Mantenimiento de Tecnologías

Para mantener el ecosistema de este proyecto seguro y al día:

1. **Actualizaciones Semanales Automatizadas (Dependabot):**
   * Configurado en [`.github/dependabot.yml`](.github/dependabot.yml) para monitorear semanalmente parches de seguridad en `pip` (Backend), `npm` (Frontend), `cargo` (Tauri Desktop) y `GitHub Actions`.
2. **Auditoría Continua (CI/CD):**
   * El pipeline de integración continua ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) ejecuta automáticamente `pip-audit` y `npm audit --audit-level=high` en cada PR o commit a las ramas principales.
3. **Script de Verificación Local:**
   * Se incluye la utilidad [`scripts/security_check.sh`](scripts/security_check.sh) para verificar permisos de archivos locales sensibles (`chmod 600` en SQLite y `700` en respaldos) y buscar posibles credenciales expuestas antes de desplegar o commitear.

---

## ⚠️ Advertencia y Descargo de Responsabilidad

Este software opera en modo local en la máquina del usuario. Los operadores son responsables de:
* Mantener su sistema operativo actualizado y protegido contra malware.
* No compartir sus archivos de base de datos ni credenciales API con terceros.
* Utilizar claves API de Binance con los permisos mínimos requeridos (solo lectura / P2P, **sin permisos de retiro habilitados**).
