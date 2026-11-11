"""
Registro y Enriquecedor Universal de Métodos de Pago P2P Multifiat (VES, USD, COP, EUR, etc.).
Abstrae la resolución de entidades bancarias, billeteras electrónicas y canales operativos,
enriqueciendo los registros obtenidos de Binance P2P con metadata operativa y comisiones financieras.
"""

from typing import List, Dict, Any, Optional, Tuple

# ---------------------------------------------------------------------------
# Dominio VES: Banca Nacional de Venezuela (SUDEBAN & Pago Móvil)
# ---------------------------------------------------------------------------
VES_PROVIDERS: List[Dict[str, Any]] = [
    {
        "code": "0102",
        "name": "Banco de Venezuela",
        "official_name": "Banco de Venezuela, S.A. Banco Universal",
        "short_name": "BDV",
        "alias_template": "Cuenta BDV (Venezuela)",
        "keywords": [
            "venezuela", "bdv", "bancodevenezuela", "banco de venezuela", "banco venezuela",
            "pagomovil bdv", "pago movil bdv", "bdv pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0134",
        "name": "Banesco",
        "official_name": "Banesco Banco Universal, C.A.",
        "short_name": "Banesco",
        "alias_template": "Cuenta Banesco (Transferencia / Pago Móvil)",
        "keywords": [
            "banesco", "banesco banco universal", "pago movil banesco",
            "pagomovil banesco", "banesco pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0105",
        "name": "Mercantil",
        "official_name": "Mercantil Banco Universal, C.A.",
        "short_name": "Mercantil",
        "alias_template": "Cuenta Mercantil",
        "keywords": [
            "mercantil", "banco mercantil", "mercantil banco universal",
            "pago movil mercantil", "mercantil pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0108",
        "name": "BBVA Provincial",
        "official_name": "Banco Provincial, S.A. Banco Universal",
        "short_name": "Provincial",
        "alias_template": "Cuenta BBVA Provincial",
        "keywords": [
            "provincial", "bbva", "bbva provincial", "banco provincial",
            "pago movil provincial", "provincial pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0172",
        "name": "Bancamiga",
        "official_name": "Bancamiga Banco Universal, C.A.",
        "short_name": "Bancamiga",
        "alias_template": "Cuenta Bancamiga",
        "keywords": [
            "bancamiga", "banco bancamiga", "pago movil bancamiga", "bancamiga pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0114",
        "name": "Bancaribe",
        "official_name": "Banco del Caribe, C.A. Banco Universal",
        "short_name": "Bancaribe",
        "alias_template": "Cuenta Bancaribe",
        "keywords": [
            "bancaribe", "banco del caribe", "pago movil bancaribe", "bancaribe pago movil"
        ],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
    {
        "code": "0116",
        "name": "Banco BFC",
        "official_name": "Banco Fondo Común, C.A. Banco Universal",
        "short_name": "BFC",
        "alias_template": "Cuenta BFC (Fondo Común)",
        "keywords": ["bfc", "banco fondo comun", "fondo comun"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0128",
        "name": "Banco Caroní",
        "official_name": "Banco Caroní, C.A. Banco Universal",
        "short_name": "Caroní",
        "alias_template": "Cuenta Banco Caroní",
        "keywords": ["caroni", "banco caroni"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0137",
        "name": "Banco Sofitasa",
        "official_name": "Banco Sofitasa Banco Universal, C.A.",
        "short_name": "Sofitasa",
        "alias_template": "Cuenta Sofitasa",
        "keywords": ["sofitasa", "banco sofitasa"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0138",
        "name": "Banco Plaza",
        "official_name": "Banco Plaza, C.A. Banco Universal",
        "short_name": "Plaza",
        "alias_template": "Cuenta Banco Plaza",
        "keywords": ["plaza", "banco plaza"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0151",
        "name": "BFC Banco Fondo Común",
        "official_name": "BFC Banco Fondo Común, C.A.",
        "short_name": "BFC",
        "alias_template": "Cuenta BFC",
        "keywords": ["fondo comun", "bfc"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0163",
        "name": "Banco del Tesoro",
        "official_name": "Banco del Tesoro, C.A. Banco Universal",
        "short_name": "Tesoro",
        "alias_template": "Cuenta Banco del Tesoro",
        "keywords": ["tesoro", "banco del tesoro"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0168",
        "name": "Bancrecer",
        "official_name": "Bancrecer, S.A. Banco Microfinanciero",
        "short_name": "Bancrecer",
        "alias_template": "Cuenta Bancrecer",
        "keywords": ["bancrecer"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0169",
        "name": "Mi Banco",
        "official_name": "Mi Banco, Banco Microfinanciero, C.A.",
        "short_name": "Mi Banco",
        "alias_template": "Cuenta Mi Banco",
        "keywords": ["mi banco", "mibanco"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0171",
        "name": "Banco Activo",
        "official_name": "Banco Activo, C.A. Banco Universal",
        "short_name": "Activo",
        "alias_template": "Cuenta Banco Activo",
        "keywords": ["activo", "banco activo"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0174",
        "name": "Banplus",
        "official_name": "Banplus Banco Universal, C.A.",
        "short_name": "Banplus",
        "alias_template": "Cuenta Banplus",
        "keywords": ["banplus", "banco banplus"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0175",
        "name": "Banco Bicentenario",
        "official_name": "Banco Bicentenario del Pueblo, de la Clase Obrera, Mujer y Comunas, Banco Universal, C.A.",
        "short_name": "Bicentenario",
        "alias_template": "Cuenta Banco Bicentenario",
        "keywords": ["bicentenario", "banco bicentenario"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0177",
        "name": "Banco de la FANB",
        "official_name": "Banco de la Fuerza Armada Nacional Bolivariana, B.U.",
        "short_name": "Banfanb",
        "alias_template": "Cuenta Banfanb",
        "keywords": ["banfanb", "fanb", "banco fanb"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": False,
    },
    {
        "code": "0191",
        "name": "Banco Nacional de Crédito",
        "official_name": "Banco Nacional de Crédito, C.A. Banco Universal",
        "short_name": "BNC",
        "alias_template": "Cuenta BNC",
        "keywords": ["bnc", "banco nacional de credito", "nacional de credito"],
        "default_pago_movil_fee": 0.3,
        "default_transfer_fee": 0.0,
        "channel": "PAGO_MOVIL",
        "is_popular": True,
    },
]

# ---------------------------------------------------------------------------
# Dominio USD: Banca Internacional, Billeteras y Pasarelas de Pago
# ---------------------------------------------------------------------------
USD_PROVIDERS: List[Dict[str, Any]] = [
    {
        "code": "ZELLE",
        "name": "Zelle",
        "official_name": "Zelle Payment Network",
        "short_name": "Zelle",
        "alias_template": "Zelle USD",
        "keywords": ["zelle", "zelle pay", "zelle usd"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "ZELLE",
        "is_popular": True,
    },
    {
        "code": "BANESCO_PANAMA",
        "name": "Banesco Panamá",
        "official_name": "Banesco S.A. (Panamá)",
        "short_name": "Banesco PA",
        "alias_template": "Cuenta Banesco Panamá USD",
        "keywords": [
            "banesco panama", "banesco panamá", "banesco pa",
            "panama banesco", "banesco internacional"
        ],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "TRANSFERENCIA",
        "is_popular": True,
    },
    {
        "code": "FACEBANK",
        "name": "Facebank",
        "official_name": "Facebank International",
        "short_name": "Facebank",
        "alias_template": "Cuenta Facebank USD",
        "keywords": ["facebank", "facebank puerto rico", "face bank"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "ACH",
        "is_popular": True,
    },
    {
        "code": "ZINLI",
        "name": "Zinli",
        "official_name": "Zinli Digital Wallet",
        "short_name": "Zinli",
        "alias_template": "Billetera Zinli USD",
        "keywords": ["zinli", "zinli wallet", "zinli app"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "WALLET",
        "is_popular": True,
    },
    {
        "code": "MERCANTIL_PANAMA",
        "name": "Mercantil Panamá",
        "official_name": "Mercantil Banco (Panamá), S.A.",
        "short_name": "Mercantil PA",
        "alias_template": "Cuenta Mercantil Panamá USD",
        "keywords": ["mercantil panama", "mercantil panamá", "mercantil pa"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "TRANSFERENCIA",
        "is_popular": True,
    },
    {
        "code": "TOWERBANK",
        "name": "Towerbank",
        "official_name": "Towerbank International Inc.",
        "short_name": "Towerbank",
        "alias_template": "Cuenta Towerbank USD",
        "keywords": ["towerbank", "tower bank", "towerbank panama"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "TRANSFERENCIA",
        "is_popular": False,
    },
    {
        "code": "BANK_OF_AMERICA",
        "name": "Bank of America",
        "official_name": "Bank of America Corporation",
        "short_name": "BOA",
        "alias_template": "Cuenta Bank of America (ACH / Wire)",
        "keywords": ["bank of america", "bofa", "boa"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "ACH",
        "is_popular": False,
    },
    {
        "code": "WELLS_FARGO",
        "name": "Wells Fargo",
        "official_name": "Wells Fargo Bank, N.A.",
        "short_name": "Wells Fargo",
        "alias_template": "Cuenta Wells Fargo (ACH / Wire)",
        "keywords": ["wells fargo", "wellsfargo", "wells"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "ACH",
        "is_popular": False,
    },
]

# ---------------------------------------------------------------------------
# Dominio COP: Banca Nacional de Colombia y Pasarelas Digitales
# ---------------------------------------------------------------------------
COP_PROVIDERS: List[Dict[str, Any]] = [
    {
        "code": "BANCOLOMBIA",
        "name": "Bancolombia",
        "official_name": "Bancolombia S.A.",
        "short_name": "Bancolombia",
        "alias_template": "Cuenta Bancolombia COP",
        "keywords": ["bancolombia", "banco de colombia"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "TRANSFERENCIA",
        "is_popular": True,
    },
    {
        "code": "NEQUI",
        "name": "Nequi",
        "official_name": "Nequi Colombia",
        "short_name": "Nequi",
        "alias_template": "Billetera Nequi COP",
        "keywords": ["nequi", "nequi colombia"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "WALLET",
        "is_popular": True,
    },
    {
        "code": "DAVIPLATA",
        "name": "Daviplata",
        "official_name": "Daviplata (Banco Davivienda)",
        "short_name": "Daviplata",
        "alias_template": "Billetera Daviplata COP",
        "keywords": ["daviplata", "davi plata"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "WALLET",
        "is_popular": True,
    },
    {
        "code": "DAVIVIENDA",
        "name": "Davivienda",
        "official_name": "Banco Davivienda S.A.",
        "short_name": "Davivienda",
        "alias_template": "Cuenta Davivienda COP",
        "keywords": ["davivienda", "banco davivienda"],
        "default_pago_movil_fee": 0.0,
        "default_transfer_fee": 0.0,
        "channel": "TRANSFERENCIA",
        "is_popular": False,
    },
]

# Compatibilidad con imports existentes de venezuela_banks
VENEZUELA_BANKS_CATALOG = VES_PROVIDERS

GENERIC_PAYMENT_TOKENS = {
    "transferencia",
    "transferencia bancaria",
    "transferenciabancaria",
    "pago móvil",
    "pago movil",
    "pagomovil",
    "pago_movil",
    "bank transfer",
    "bank_transfer",
    "bank",
    "transfer",
    "efectivo",
    "cash",
    "no especificado",
    "-",
    "",
}


def get_providers_for_fiat(fiat: Optional[str]) -> List[Dict[str, Any]]:
    """Retorna la lista de proveedores registrados para una moneda fiat específica."""
    curr = (fiat or "VES").strip().upper()
    if curr == "VES":
        return VES_PROVIDERS
    if curr in ("USD", "USDT"):
        return USD_PROVIDERS
    if curr == "COP":
        return COP_PROVIDERS
    return []


def resolve_payment_method_metadata(
    term: Optional[str], fiat_currency: Optional[str] = "VES"
) -> Optional[Dict[str, Any]]:
    """
    Busca y enriquece un método de pago analizando el string recibido de Binance
    en el dominio correspondiente a la divisa fiat.
    """
    if not term:
        return None
    clean = term.strip().lower()
    if clean in GENERIC_PAYMENT_TOKENS:
        return None

    providers = get_providers_for_fiat(fiat_currency)
    if not providers and fiat_currency not in ("VES", "USD", "COP"):
        # Si el fiat es de otro país, también buscamos en USD y VES por si está mal etiquetado
        providers = USD_PROVIDERS + VES_PROVIDERS + COP_PROVIDERS

    # 1. Coincidencia por código de banco o identificador
    for p in providers:
        if p["code"].lower() == clean:
            return p

    # 2. Coincidencia por nombre exacto o corto
    for p in providers:
        if p["name"].lower() == clean or p.get("short_name", "").lower() == clean:
            return p

    # 3. Coincidencia por palabras clave
    for p in providers:
        for kw in p.get("keywords", []):
            if kw == clean or kw in clean or clean in kw:
                return p

    return None


def find_bank_in_catalog(term: str) -> Optional[Dict[str, Any]]:
    """Función de compatibilidad con código anterior que busca bancos en el catálogo VES."""
    return resolve_payment_method_metadata(term, fiat_currency="VES")
