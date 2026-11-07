"""
Conexión con la API pública (sin credenciales) del mercado P2P de Binance.

Destinada a obtener estadísticas del mercado P2P (precios de anuncios, mejores tasas,
promedios, spread compra/venta) para un par activo/fiat determinado (ej. USDT/VES).

Endpoint utilizado (público, no requiere API Key):
    POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search

Nota sobre `tradeType` (perspectiva del usuario que consulta el mercado):
    - "BUY"  -> anuncios de comerciantes que VENDEN el activo (yo compro USDT).
    - "SELL" -> anuncios de comerciantes que COMPRAN el activo (yo vendo USDT).
"""

import os
import sys
import ssl
import json
import time
import statistics
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

SYSTEM_CA_PATHS = [
    "/etc/ssl/certs/ca-bundle.crt",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/cert.pem",
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
]

def _get_ssl_context() -> ssl.SSLContext:
    """Crea un contexto SSL robusto para entornos congelados con PyInstaller o sistemas Linux."""
    # 1. Intentar certifi
    try:
        import certifi
        ca = certifi.where()
        if os.path.exists(ca):
            return ssl.create_default_context(cafile=ca)
    except Exception:
        pass

    # 2. Intentar archivo empaquetado en sys._MEIPASS
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        meipass_cert = os.path.join(sys._MEIPASS, "certifi", "cacert.pem")
        if os.path.exists(meipass_cert):
            return ssl.create_default_context(cafile=meipass_cert)

    # 3. Intentar CAs del sistema operativo
    for ca_path in SYSTEM_CA_PATHS:
        if os.path.exists(ca_path):
            try:
                return ssl.create_default_context(cafile=ca_path)
            except Exception:
                pass

    return ssl.create_default_context()

P2P_PUBLIC_BASE_URL = "https://p2p.binance.com"
P2P_ADV_SEARCH_ENDPOINT = "/bapi/c2c/v2/friendly/c2c/adv/search"
P2P_PUBLIC_CONFIG_PATH = (
    Path(__file__).resolve().parent.parent.parent / ".binance_p2p_public_config.json"
)

VALID_TRADE_TYPES = ("BUY", "SELL")
MAX_ROWS_PER_PAGE = 20  # Tope de filas por página aceptado por el endpoint público

DEFAULT_P2P_PUBLIC_CONFIG: Dict[str, Any] = {
    "enabled": True,
    "asset": "USDT",
    "fiat": "VES",
    "pay_types": [],  # ej. ["Banesco", "Mercantil", "PagoMovil"]; vacío = todos
    "trans_amount": None,  # Monto en fiat para filtrar anuncios que lo acepten
    "rows": 20,
    "pages": 1,
    "publisher_type": None,  # None = todos | "merchant" = solo comerciantes verificados
    "top_n": 5,  # Cantidad de mejores anuncios usados para el precio promedio "top"
    "timeout_seconds": 15,
    "refresh_interval_seconds": 60,  # 0 = desactivado/manual, 15, 30, 60, 120, 300
}


# ---------------------------------------------------------------------------
# Configuración local
# ---------------------------------------------------------------------------

def _sanitize_config(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Valida y normaliza los parámetros de configuración de la API pública P2P."""
    cfg = dict(DEFAULT_P2P_PUBLIC_CONFIG)
    cfg.update({k: v for k, v in (raw or {}).items() if k in DEFAULT_P2P_PUBLIC_CONFIG})

    cfg["enabled"] = bool(cfg.get("enabled", True))
    cfg["asset"] = str(cfg.get("asset") or "USDT").upper().strip()
    cfg["fiat"] = str(cfg.get("fiat") or "VES").upper().strip()

    pay_types = cfg.get("pay_types") or []
    if isinstance(pay_types, str):
        pay_types = [p for p in pay_types.split(",")]
    cfg["pay_types"] = [str(p).strip() for p in pay_types if str(p).strip()]

    try:
        amount = float(cfg.get("trans_amount")) if cfg.get("trans_amount") not in (None, "") else None
        cfg["trans_amount"] = amount if amount and amount > 0 else None
    except (TypeError, ValueError):
        cfg["trans_amount"] = None

    def _clamp_int(value: Any, default: int, lo: int, hi: int) -> int:
        try:
            return max(lo, min(hi, int(value)))
        except (TypeError, ValueError):
            return default

    cfg["rows"] = _clamp_int(cfg.get("rows"), 20, 1, MAX_ROWS_PER_PAGE)
    cfg["pages"] = _clamp_int(cfg.get("pages"), 1, 1, 10)
    cfg["top_n"] = _clamp_int(cfg.get("top_n"), 5, 1, 50)
    cfg["timeout_seconds"] = _clamp_int(cfg.get("timeout_seconds"), 15, 3, 60)
    cfg["refresh_interval_seconds"] = _clamp_int(cfg.get("refresh_interval_seconds"), 60, 0, 3600)

    publisher = str(cfg.get("publisher_type") or "").strip().lower()
    cfg["publisher_type"] = "merchant" if publisher == "merchant" else None
    return cfg


def get_p2p_public_config() -> Dict[str, Any]:
    """Obtiene la configuración guardada de la API pública P2P (o los valores por defecto)."""
    if P2P_PUBLIC_CONFIG_PATH.exists():
        try:
            data = json.loads(P2P_PUBLIC_CONFIG_PATH.read_text(encoding="utf-8"))
            cfg = _sanitize_config(data)
            cfg["updated_at"] = data.get("updated_at")
            return cfg
        except Exception:
            pass
    cfg = _sanitize_config({})
    cfg["updated_at"] = None
    return cfg


def save_p2p_public_config(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Guarda localmente la configuración de la API pública P2P."""
    current = get_p2p_public_config()
    # Solo se actualizan las claves enviadas; `None` es válido para limpiar trans_amount/publisher_type.
    current.update({k: v for k, v in (raw or {}).items() if k in DEFAULT_P2P_PUBLIC_CONFIG})
    cfg = _sanitize_config(current)
    cfg["updated_at"] = datetime.now(timezone.utc).isoformat()
    P2P_PUBLIC_CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    try:
        os.chmod(P2P_PUBLIC_CONFIG_PATH, 0o600)
    except OSError:
        pass
    return cfg


def reset_p2p_public_config() -> Dict[str, Any]:
    """Restablece la configuración de la API pública P2P a sus valores por defecto."""
    try:
        if P2P_PUBLIC_CONFIG_PATH.exists():
            P2P_PUBLIC_CONFIG_PATH.unlink()
    except OSError:
        pass
    return get_p2p_public_config()


# ---------------------------------------------------------------------------
# Cliente HTTP público
# ---------------------------------------------------------------------------

def _public_post(endpoint: str, body: Dict[str, Any], timeout: int = 15) -> Dict[str, Any]:
    """Realiza una petición POST pública (sin firma) hacia la web API P2P de Binance."""
    url = f"{P2P_PUBLIC_BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Language": "es-ES,es;q=0.9",
            "Cache-Control": "no-cache",
            "Origin": P2P_PUBLIC_BASE_URL,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) P2PLedgerLocal/1.0",
        },
        method="POST",
    )

    try:
        ctx = _get_ssl_context()
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Binance P2P público HTTP {e.code}: {err_body[:300]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Error de red al conectar con Binance P2P: {e.reason}")
    except json.JSONDecodeError:
        raise RuntimeError("Respuesta inválida (no JSON) desde Binance P2P.")

    # La web API devuelve {"code": "000000", "success": true, "data": [...], "total": N}
    if isinstance(data, dict) and data.get("success") is False:
        msg = data.get("message") or data.get("messageDetail") or "Solicitud rechazada"
        raise RuntimeError(f"Binance P2P público ({data.get('code')}): {msg}")
    return data


def _normalize_ad(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convierte un anuncio crudo del mercado P2P en un registro plano."""
    adv = item.get("adv") or {}
    advertiser = item.get("advertiser") or {}
    try:
        price = float(adv.get("price") or 0.0)
    except (TypeError, ValueError):
        return None
    if price <= 0:
        return None

    def _f(v: Any) -> float:
        try:
            return float(v or 0.0)
        except (TypeError, ValueError):
            return 0.0

    return {
        "adv_no": str(adv.get("advNo") or ""),
        "trade_type": str(adv.get("tradeType") or "").upper(),
        "asset": str(adv.get("asset") or ""),
        "fiat": str(adv.get("fiatUnit") or ""),
        "price": price,
        "available_qty": _f(adv.get("surplusAmount") or adv.get("tradableQuantity")),
        "min_fiat": _f(adv.get("minSingleTransAmount")),
        "max_fiat": _f(adv.get("dynamicMaxSingleTransAmount") or adv.get("maxSingleTransAmount")),
        "pay_methods": [
            str(tm.get("tradeMethodName") or tm.get("identifier") or "").strip()
            for tm in (adv.get("tradeMethods") or [])
            if (tm.get("tradeMethodName") or tm.get("identifier"))
        ],
        "advertiser": str(advertiser.get("nickName") or "-"),
        "user_type": str(advertiser.get("userType") or "user"),
        "month_orders": int(advertiser.get("monthOrderCount") or 0),
        "month_finish_rate": _f(advertiser.get("monthFinishRate")),
        "positive_rate": _f(advertiser.get("positiveRate")),
    }


def fetch_p2p_market_ads(
    trade_type: str,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Descarga los anuncios públicos del mercado P2P para un `trade_type` ("BUY" | "SELL")
    respetando la configuración guardada (activo, fiat, métodos de pago, monto, páginas).
    """
    trade_type = str(trade_type or "").upper()
    if trade_type not in VALID_TRADE_TYPES:
        raise ValueError("trade_type debe ser 'BUY' o 'SELL'.")

    cfg = _sanitize_config(config) if config is not None else get_p2p_public_config()
    ads: List[Dict[str, Any]] = []
    total_reported = 0

    for page in range(1, cfg["pages"] + 1):
        body: Dict[str, Any] = {
            "asset": cfg["asset"],
            "fiat": cfg["fiat"],
            "tradeType": trade_type,
            "page": page,
            "rows": cfg["rows"],
            "payTypes": cfg["pay_types"],
            "publisherType": cfg["publisher_type"],
            "countries": [],
            "proMerchantAds": False,
            "shieldMerchantAds": False,
        }
        if cfg["trans_amount"]:
            body["transAmount"] = cfg["trans_amount"]

        resp = _public_post(P2P_ADV_SEARCH_ENDPOINT, body, timeout=cfg["timeout_seconds"])
        items = resp.get("data") or []
        total_reported = int(resp.get("total") or total_reported or 0)

        for item in items:
            norm = _normalize_ad(item)
            if norm:
                ads.append(norm)

        if len(items) < cfg["rows"]:
            break
        if page < cfg["pages"]:
            time.sleep(0.25)  # Evitar rate-limit del endpoint público

    return {
        "trade_type": trade_type,
        "asset": cfg["asset"],
        "fiat": cfg["fiat"],
        "total_reported": total_reported,
        "ads": ads,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Estadísticas del mercado
# ---------------------------------------------------------------------------

def compute_side_stats(ads: List[Dict[str, Any]], trade_type: str, top_n: int = 5) -> Dict[str, Any]:
    """Calcula estadísticas de precio para un lado del mercado (BUY o SELL)."""
    prices = [a["price"] for a in ads if a.get("price")]
    if not prices:
        return {"count": 0, "best": None, "worst": None, "avg": None, "median": None,
                "top_avg": None, "weighted_avg": None, "total_available": 0.0}

    # Para BUY (yo compro) el mejor precio es el más bajo; para SELL (yo vendo), el más alto.
    ordered = sorted(prices) if trade_type == "BUY" else sorted(prices, reverse=True)
    top = ordered[: max(1, top_n)]

    total_qty = sum(a.get("available_qty") or 0.0 for a in ads)
    weighted = (
        sum(a["price"] * (a.get("available_qty") or 0.0) for a in ads) / total_qty
        if total_qty > 0 else None
    )

    return {
        "count": len(prices),
        "best": round(ordered[0], 4),
        "worst": round(ordered[-1], 4),
        "avg": round(statistics.fmean(prices), 4),
        "median": round(statistics.median(prices), 4),
        "top_avg": round(statistics.fmean(top), 4),
        "weighted_avg": round(weighted, 4) if weighted else None,
        "total_available": round(total_qty, 2),
    }


def fetch_p2p_market_snapshot(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene una instantánea del mercado P2P (ambos lados) con sus estadísticas y el spread.
    spread = mejor precio de venta (SELL) - mejor precio de compra (BUY).
    """
    cfg = _sanitize_config(config) if config is not None else get_p2p_public_config()
    started = time.perf_counter()

    buy_side = fetch_p2p_market_ads("BUY", cfg)
    sell_side = fetch_p2p_market_ads("SELL", cfg)

    buy_stats = compute_side_stats(buy_side["ads"], "BUY", cfg["top_n"])
    sell_stats = compute_side_stats(sell_side["ads"], "SELL", cfg["top_n"])

    spread_abs = spread_pct = None
    if buy_stats["best"] and sell_stats["best"]:
        spread_abs = round(sell_stats["best"] - buy_stats["best"], 4)
        spread_pct = round((spread_abs / buy_stats["best"]) * 100, 3)

    return {
        "asset": cfg["asset"],
        "fiat": cfg["fiat"],
        "filters": {
            "pay_types": cfg["pay_types"],
            "trans_amount": cfg["trans_amount"],
            "publisher_type": cfg["publisher_type"],
            "rows": cfg["rows"],
            "pages": cfg["pages"],
            "top_n": cfg["top_n"],
        },
        "buy": {"stats": buy_stats, "total_reported": buy_side["total_reported"], "ads": buy_side["ads"]},
        "sell": {"stats": sell_stats, "total_reported": sell_side["total_reported"], "ads": sell_side["ads"]},
        "spread": {"absolute": spread_abs, "percent": spread_pct},
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def test_p2p_public_connection(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Verifica la conectividad con la API pública P2P devolviendo un resumen ligero."""
    cfg = _sanitize_config(config) if config is not None else get_p2p_public_config()
    try:
        snap = fetch_p2p_market_snapshot(cfg)
        return {
            "ok": True,
            "asset": snap["asset"],
            "fiat": snap["fiat"],
            "best_buy": snap["buy"]["stats"]["best"],
            "best_sell": snap["sell"]["stats"]["best"],
            "buy_ads": snap["buy"]["stats"]["count"],
            "sell_ads": snap["sell"]["stats"]["count"],
            "spread": snap["spread"],
            "latency_ms": snap["latency_ms"],
            "checked_at": snap["fetched_at"],
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "checked_at": datetime.now(timezone.utc).isoformat()}
