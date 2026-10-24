"""
Catálogo Oficial de la Banca Nacional de Venezuela (SUDEBAN) y vinculación con Binance P2P.
Incluye códigos bancarios (0102, 0134, etc.), nombres comerciales, variantes fonéticas
y cadenas devueltas por los métodos de pago de Binance C2C API.
"""

from typing import List, Dict, Any, Optional

VENEZUELA_BANKS_CATALOG: List[Dict[str, Any]] = [
    {
        "code": "0102",
        "name": "Banco de Venezuela",
        "official_name": "Banco de Venezuela, S.A. Banco Universal",
        "short_name": "BDV",
        "alias_template": "Cuenta BDV (Venezuela)",
        "keywords": [
            "venezuela",
            "bdv",
            "bancodevenezuela",
            "banco de venezuela",
            "banco venezuela",
            "pagomovil bdv",
            "pago movil bdv",
            "bdv pago movil",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0134",
        "name": "Banesco",
        "official_name": "Banesco Banco Universal, C.A.",
        "short_name": "Banesco",
        "alias_template": "Cuenta Banesco (Transferencia / Pago Móvil)",
        "keywords": [
            "banesco",
            "banesco banco universal",
            "pago movil banesco",
            "pagomovil banesco",
            "banesco pago movil",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0105",
        "name": "Mercantil",
        "official_name": "Mercantil Banco Universal, C.A.",
        "short_name": "Mercantil",
        "alias_template": "Cuenta Mercantil (Transferencia / Pago Móvil)",
        "keywords": [
            "mercantil",
            "banco mercantil",
            "mercantil banco universal",
            "pago movil mercantil",
            "pagomovil mercantil",
            "mercantil pago movil",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0108",
        "name": "Banco Provincial",
        "official_name": "BBVA Banco Provincial, S.A. Banco Universal",
        "short_name": "BBVA Provincial",
        "alias_template": "Cuenta BBVA Provincial",
        "keywords": [
            "provincial",
            "bbva",
            "bbva provincial",
            "banco provincial",
            "bancoprovincial",
            "pago movil provincial",
            "pagomovil provincial",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0172",
        "name": "Bancamiga",
        "official_name": "Bancamiga Banco Universal, C.A.",
        "short_name": "Bancamiga",
        "alias_template": "Cuenta Bancamiga (Transferencia / Pago Móvil)",
        "keywords": [
            "bancamiga",
            "banco amiga",
            "bancamiga banco universal",
            "pago movil bancamiga",
            "pagomovil bancamiga",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0191",
        "name": "BNC",
        "official_name": "Banco Nacional de Crédito, C.A. Banco Universal",
        "short_name": "BNC",
        "alias_template": "Banco Nacional de Crédito (BNC)",
        "keywords": [
            "bnc",
            "bncbanconacional",
            "banco nacional de credito",
            "banco nacional de crédito",
            "banconacionaldecredito",
            "nacional de credito",
            "nacional de crédito",
            "pago movil bnc",
            "pagomovil bnc",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": True,
    },
    {
        "code": "0114",
        "name": "Bancaribe",
        "official_name": "Bancaribe, C.A. Banco Universal",
        "short_name": "Bancaribe",
        "alias_template": "Cuenta Bancaribe",
        "keywords": [
            "bancaribe",
            "banco del caribe",
            "bancocaribe",
            "pago movil bancaribe",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0115",
        "name": "Banco Exterior",
        "official_name": "Banco Exterior, C.A. Banco Universal",
        "short_name": "Exterior",
        "alias_template": "Cuenta Banco Exterior",
        "keywords": [
            "exterior",
            "banco exterior",
            "bancoexterior",
            "pago movil exterior",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0175",
        "name": "Banco Bicentenario",
        "official_name": "Banco Bicentenario del Pueblo, Banco Universal C.A.",
        "short_name": "Bicentenario",
        "alias_template": "Cuenta Banco Bicentenario",
        "keywords": [
            "bicentenario",
            "banco bicentenario",
            "bancobicentenario",
            "pago movil bicentenario",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0163",
        "name": "Banco del Tesoro",
        "official_name": "Banco del Tesoro, C.A. Banco Universal",
        "short_name": "Tesoro",
        "alias_template": "Cuenta Banco del Tesoro",
        "keywords": [
            "tesoro",
            "banco del tesoro",
            "bancodeltesoro",
            "pago movil tesoro",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0174",
        "name": "Banplus",
        "official_name": "Banplus Banco Universal, C.A.",
        "short_name": "Banplus",
        "alias_template": "Cuenta Banplus",
        "keywords": [
            "banplus",
            "banco banplus",
            "pago movil banplus",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0151",
        "name": "BFC Banco Fondo Común",
        "official_name": "Banco Fondo Común, C.A. Banco Universal",
        "short_name": "Fondo Común (BFC)",
        "alias_template": "Cuenta BFC Fondo Común",
        "keywords": [
            "bfc",
            "fondo comun",
            "fondo común",
            "banco fondo comun",
            "banco fondo común",
            "pago movil bfc",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0137",
        "name": "Banco Sofitasa",
        "official_name": "Banco Sofitasa Banco Universal, C.A.",
        "short_name": "Sofitasa",
        "alias_template": "Cuenta Banco Sofitasa",
        "keywords": [
            "sofitasa",
            "banco sofitasa",
            "pago movil sofitasa",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0138",
        "name": "Banco Plaza",
        "official_name": "Banco Plaza, Banco Universal",
        "short_name": "Banco Plaza",
        "alias_template": "Cuenta Banco Plaza",
        "keywords": [
            "plaza",
            "banco plaza",
            "bancoplaza",
            "pago movil plaza",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0128",
        "name": "Banco Caroní",
        "official_name": "Banco Caroní, C.A. Banco Universal",
        "short_name": "Caroní",
        "alias_template": "Cuenta Banco Caroní",
        "keywords": [
            "caroni",
            "caroní",
            "banco caroni",
            "banco caroní",
            "pago movil caroni",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0169",
        "name": "Mi Banco",
        "official_name": "Mi Banco, Banco Microfinanciero, C.A.",
        "short_name": "Mi Banco",
        "alias_template": "Cuenta Mi Banco",
        "keywords": [
            "mi banco",
            "mibanco",
            "pago movil mi banco",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0177",
        "name": "BANFANB",
        "official_name": "Banco de la Fuerza Armada Nacional Bolivariana, B.U.",
        "short_name": "BANFANB",
        "alias_template": "Cuenta BANFANB",
        "keywords": [
            "banfanb",
            "fuerza armada",
            "banco de la fuerza armada",
            "pago movil banfanb",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0171",
        "name": "Banco Activo",
        "official_name": "Banco Activo, Banco Universal",
        "short_name": "Activo",
        "alias_template": "Cuenta Banco Activo",
        "keywords": [
            "activo",
            "banco activo",
            "bancoactivo",
            "pago movil activo",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0157",
        "name": "Banco del Sur (Delsur)",
        "official_name": "Delsur Banco Universal",
        "short_name": "Delsur",
        "alias_template": "Cuenta Delsur",
        "keywords": [
            "delsur",
            "del sur",
            "banco del sur",
            "pago movil delsur",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0168",
        "name": "Bancrecer",
        "official_name": "Bancrecer, S.A. Banco Microfinanciero",
        "short_name": "Bancrecer",
        "alias_template": "Cuenta Bancrecer",
        "keywords": [
            "bancrecer",
            "banco bancrecer",
            "pago movil bancrecer",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
    {
        "code": "0178",
        "name": "N58 Banco Digital",
        "official_name": "N58 Banco Digital Microfinanciero, S.A.",
        "short_name": "N58",
        "alias_template": "Cuenta N58 Banco Digital",
        "keywords": [
            "n58",
            "banco n58",
            "n58 banco digital",
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "is_popular": False,
    },
]


def find_bank_in_catalog(term: str) -> Optional[Dict[str, Any]]:
    """
    Busca un banco en el catálogo por código SUDEBAN (0102), nombre o palabras clave.
    """
    if not term:
        return None
    clean = term.strip().lower()

    # Coincidencia por código
    for b in VENEZUELA_BANKS_CATALOG:
        if b["code"] == clean:
            return b

    # Coincidencia por nombre exacto o corto
    for b in VENEZUELA_BANKS_CATALOG:
        if b["name"].lower() == clean or b["short_name"].lower() == clean:
            return b

    # Coincidencia por palabras clave
    for b in VENEZUELA_BANKS_CATALOG:
        for kw in b["keywords"]:
            if kw == clean or kw in clean or clean in kw:
                return b

    return None
