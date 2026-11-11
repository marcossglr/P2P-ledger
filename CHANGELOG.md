# Changelog

## [0.5.0](https://github.com/marcossglr/P2P-ledger/compare/v0.4.0...v0.5.0) (2026-11-11)


### Features

* add alembic migrations, centralized settings, database decoupling, and API security ([52abf39](https://github.com/marcossglr/P2P-ledger/commit/52abf3907ffeb55e4a9a79ffdec79000ac817618))
* **ci:** add bump_version script to synchronize semver releases across all project modules ([cf9de01](https://github.com/marcossglr/P2P-ledger/commit/cf9de01a9c775722c2c18d63b5db51ee400520d1))
* **frontend:** create centralized API client service ([3525d9d](https://github.com/marcossglr/P2P-ledger/commit/3525d9d2f8160de3bdb462b5714b823637eca70a))
* **history:** alinear filtros con el dashboard y mover boton de formulas a barra superior ([cc24a06](https://github.com/marcossglr/P2P-ledger/commit/cc24a06050fbc286d6ff5626c9550382d903b309))
* integrar WebSockets de Binance, gráfica P2P interactiva y alertas de audio ([e8a8648](https://github.com/marcossglr/P2P-ledger/commit/e8a86487e380efa359b21d3e39930eb1c371f229))
* **market:** sincronización dinámica de criptos P2P por fiat y optimización del radar ([c02ba7f](https://github.com/marcossglr/P2P-ledger/commit/c02ba7f63531637a0fbe33f0a62ce319ea3a819c))
* **settings:** integrar modulo de actualizaciones en ajustes y compatibilidad de arquitectura universal en CI ([394cea5](https://github.com/marcossglr/P2P-ledger/commit/394cea5d48bb998e1bf6773266f7b49fac3d8f6f))
* soporte nativo de escritorio con tauri v2 y pipeline de release multiplataforma (.rpm y .exe) ([80861c6](https://github.com/marcossglr/P2P-ledger/commit/80861c691aaddcb56385df85d73ae4c286b179d0))
* **ui:** standardize modals, treasury navigation, and market pair selector ([6cf3667](https://github.com/marcossglr/P2P-ledger/commit/6cf36678c02762f8107b2b8a6a006a87ff559a28))
* **updater:** enlazar clave publica real de minisign para verificacion de releases ([acb53d3](https://github.com/marcossglr/P2P-ledger/commit/acb53d34aaf575f4130670ca623136f404248b65))
* **updater:** habilitar createUpdaterArtifacts y actualizar version a 0.3.2 ([9909885](https://github.com/marcossglr/P2P-ledger/commit/990988540925aeedd94be5d933e301661509dcec))
* **updater:** integrar tauri-plugin-updater y configurar release automatica con firmas criptograficas ([8b6a385](https://github.com/marcossglr/P2P-ledger/commit/8b6a385ed63106c2038f7ab5b64ccd87c56a92a7))


### Bug Fixes

* **api:** route requests to local sidecar backend in Tauri desktop production (v0.3.4) ([647f8ed](https://github.com/marcossglr/P2P-ledger/commit/647f8ed5a65cf2fa84ccb60d6eb818037442bf16))
* **backend:** agregar import faltante de Tuple en binance_p2p_public ([31411cc](https://github.com/marcossglr/P2P-ledger/commit/31411cc70cd61fdd69440c5f1c98ef9f8d66f53d))
* **backend:** clean parameter defaults in operations router ([54aca17](https://github.com/marcossglr/P2P-ledger/commit/54aca17fc9bb0b3dddf992f68282841149d0a5ea))
* **ci:** conceder permisos contents:write a github actions para publicar releases ([5cfbe57](https://github.com/marcossglr/P2P-ledger/commit/5cfbe57d262a76321abfa67879367e3de02bdc6d))
* **ci:** track frontend package-lock.json for npm ci reproducibility ([1929672](https://github.com/marcossglr/P2P-ledger/commit/192967273cccecc159bf22de101f96c423a2f794))
* **dashboard:** optimizar intervalo de consultas del radar P2P a 15-20s con jitter aleatorio y desacoplar dependencias ([e9389bd](https://github.com/marcossglr/P2P-ledger/commit/e9389bd05f40efe0abba7c291dd8cad5351d395f))
* **desktop:** eliminar fallback ciego a puerto 8000, validar liveness de PID y salud de backend en arranque ([ffd32ae](https://github.com/marcossglr/P2P-ledger/commit/ffd32aedf202431fcea82b07b3752b04dff4503a))
* **desktop:** implement ephemeral dynamic port and parent watchdog to prevent orphan backend processes ([4819f10](https://github.com/marcossglr/P2P-ledger/commit/4819f109a530b1d78cf6c3e599551510dd7b9950))
* **frontend:** strengthen security, CSP, error boundary, and input guards ([5bbe2be](https://github.com/marcossglr/P2P-ledger/commit/5bbe2bee3bbb4bb59c93e640545b0ce5e2dfc727))
* **network:** integrate tauri-plugin-http native client to bypass WebKitGTK CORS and loopback restrictions (v0.3.5) ([921af66](https://github.com/marcossglr/P2P-ledger/commit/921af66551b85bbd079e727e6d3d7fd2d2511cf7))
* **ssl:** bundle certifi and system CA trust chain into PyInstaller backend sidecar (v0.3.6) ([50c6fc6](https://github.com/marcossglr/P2P-ledger/commit/50c6fc66770f96a294bd68470693857b24bab2d1))
* **tauri:** flexibilizar versiones de crates de rust a major v2 para emparejar con npm ([0da53cb](https://github.com/marcossglr/P2P-ledger/commit/0da53cbe99e21176f89e943788e75c82d8256112))
* **updater:** actualizar clave publica de tauri a par minisign valido ([c319bfb](https://github.com/marcossglr/P2P-ledger/commit/c319bfb7ec2b13a203f7caf6d9c9561cdca377f9))
* **updater:** codificar pubkey en base64 de archivo minisign como requiere tauri ([60ed3ef](https://github.com/marcossglr/P2P-ledger/commit/60ed3efe3078996bde0d0916ad0bd2ea080a8f65))
* **updater:** use official @tauri-apps/plugin-updater and process guest APIs (v0.3.3) ([8b2ad0f](https://github.com/marcossglr/P2P-ledger/commit/8b2ad0fcfda47af9efd63a2194322f9570ee8175))
* **windows:** agregar icon.ico requerido por el compilador de windows y robustecer comando powershell para sidecar ([9caccea](https://github.com/marcossglr/P2P-ledger/commit/9cacceae5a1bb0ee4898f40f936549fa59f75d17))

## [0.4.0](https://github.com/marcossglr/P2P-ledger/compare/p2p-ledger-v0.3.9...p2p-ledger-v0.4.0) (2026-11-11)


### Features

* add alembic migrations, centralized settings, database decoupling, and API security ([52abf39](https://github.com/marcossglr/P2P-ledger/commit/52abf3907ffeb55e4a9a79ffdec79000ac817618))
* **ci:** add bump_version script to synchronize semver releases across all project modules ([cf9de01](https://github.com/marcossglr/P2P-ledger/commit/cf9de01a9c775722c2c18d63b5db51ee400520d1))
* **frontend:** create centralized API client service ([3525d9d](https://github.com/marcossglr/P2P-ledger/commit/3525d9d2f8160de3bdb462b5714b823637eca70a))
* **history:** alinear filtros con el dashboard y mover boton de formulas a barra superior ([cc24a06](https://github.com/marcossglr/P2P-ledger/commit/cc24a06050fbc286d6ff5626c9550382d903b309))
* integrar WebSockets de Binance, gráfica P2P interactiva y alertas de audio ([e8a8648](https://github.com/marcossglr/P2P-ledger/commit/e8a86487e380efa359b21d3e39930eb1c371f229))
* **market:** sincronización dinámica de criptos P2P por fiat y optimización del radar ([c02ba7f](https://github.com/marcossglr/P2P-ledger/commit/c02ba7f63531637a0fbe33f0a62ce319ea3a819c))
* **settings:** integrar modulo de actualizaciones en ajustes y compatibilidad de arquitectura universal en CI ([394cea5](https://github.com/marcossglr/P2P-ledger/commit/394cea5d48bb998e1bf6773266f7b49fac3d8f6f))
* soporte nativo de escritorio con tauri v2 y pipeline de release multiplataforma (.rpm y .exe) ([80861c6](https://github.com/marcossglr/P2P-ledger/commit/80861c691aaddcb56385df85d73ae4c286b179d0))
* **ui:** standardize modals, treasury navigation, and market pair selector ([6cf3667](https://github.com/marcossglr/P2P-ledger/commit/6cf36678c02762f8107b2b8a6a006a87ff559a28))
* **updater:** enlazar clave publica real de minisign para verificacion de releases ([acb53d3](https://github.com/marcossglr/P2P-ledger/commit/acb53d34aaf575f4130670ca623136f404248b65))
* **updater:** habilitar createUpdaterArtifacts y actualizar version a 0.3.2 ([9909885](https://github.com/marcossglr/P2P-ledger/commit/990988540925aeedd94be5d933e301661509dcec))
* **updater:** integrar tauri-plugin-updater y configurar release automatica con firmas criptograficas ([8b6a385](https://github.com/marcossglr/P2P-ledger/commit/8b6a385ed63106c2038f7ab5b64ccd87c56a92a7))


### Bug Fixes

* **api:** route requests to local sidecar backend in Tauri desktop production (v0.3.4) ([647f8ed](https://github.com/marcossglr/P2P-ledger/commit/647f8ed5a65cf2fa84ccb60d6eb818037442bf16))
* **backend:** agregar import faltante de Tuple en binance_p2p_public ([31411cc](https://github.com/marcossglr/P2P-ledger/commit/31411cc70cd61fdd69440c5f1c98ef9f8d66f53d))
* **backend:** clean parameter defaults in operations router ([54aca17](https://github.com/marcossglr/P2P-ledger/commit/54aca17fc9bb0b3dddf992f68282841149d0a5ea))
* **ci:** conceder permisos contents:write a github actions para publicar releases ([5cfbe57](https://github.com/marcossglr/P2P-ledger/commit/5cfbe57d262a76321abfa67879367e3de02bdc6d))
* **ci:** track frontend package-lock.json for npm ci reproducibility ([1929672](https://github.com/marcossglr/P2P-ledger/commit/192967273cccecc159bf22de101f96c423a2f794))
* **dashboard:** optimizar intervalo de consultas del radar P2P a 15-20s con jitter aleatorio y desacoplar dependencias ([e9389bd](https://github.com/marcossglr/P2P-ledger/commit/e9389bd05f40efe0abba7c291dd8cad5351d395f))
* **desktop:** eliminar fallback ciego a puerto 8000, validar liveness de PID y salud de backend en arranque ([ffd32ae](https://github.com/marcossglr/P2P-ledger/commit/ffd32aedf202431fcea82b07b3752b04dff4503a))
* **desktop:** implement ephemeral dynamic port and parent watchdog to prevent orphan backend processes ([4819f10](https://github.com/marcossglr/P2P-ledger/commit/4819f109a530b1d78cf6c3e599551510dd7b9950))
* **frontend:** strengthen security, CSP, error boundary, and input guards ([5bbe2be](https://github.com/marcossglr/P2P-ledger/commit/5bbe2bee3bbb4bb59c93e640545b0ce5e2dfc727))
* **network:** integrate tauri-plugin-http native client to bypass WebKitGTK CORS and loopback restrictions (v0.3.5) ([921af66](https://github.com/marcossglr/P2P-ledger/commit/921af66551b85bbd079e727e6d3d7fd2d2511cf7))
* **ssl:** bundle certifi and system CA trust chain into PyInstaller backend sidecar (v0.3.6) ([50c6fc6](https://github.com/marcossglr/P2P-ledger/commit/50c6fc66770f96a294bd68470693857b24bab2d1))
* **tauri:** flexibilizar versiones de crates de rust a major v2 para emparejar con npm ([0da53cb](https://github.com/marcossglr/P2P-ledger/commit/0da53cbe99e21176f89e943788e75c82d8256112))
* **updater:** actualizar clave publica de tauri a par minisign valido ([c319bfb](https://github.com/marcossglr/P2P-ledger/commit/c319bfb7ec2b13a203f7caf6d9c9561cdca377f9))
* **updater:** codificar pubkey en base64 de archivo minisign como requiere tauri ([60ed3ef](https://github.com/marcossglr/P2P-ledger/commit/60ed3efe3078996bde0d0916ad0bd2ea080a8f65))
* **updater:** use official @tauri-apps/plugin-updater and process guest APIs (v0.3.3) ([8b2ad0f](https://github.com/marcossglr/P2P-ledger/commit/8b2ad0fcfda47af9efd63a2194322f9570ee8175))
* **windows:** agregar icon.ico requerido por el compilador de windows y robustecer comando powershell para sidecar ([9caccea](https://github.com/marcossglr/P2P-ledger/commit/9cacceae5a1bb0ee4898f40f936549fa59f75d17))
