import os
import json
import time
import hmac
import hashlib
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / ".binance_credentials.json"
FUNDING_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / ".binance_funding_cache.json"
USER_ADS_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / ".binance_user_ads_cache.json"
BINANCE_BASE_URL = "https://api.binance.com"


def get_cached_funding_asset() -> Dict[str, Any]:
    """Obtiene el último balance de la cuenta de fondos de Binance guardado en caché."""
    if FUNDING_CACHE_PATH.exists():
        try:
            return json.loads(FUNDING_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"asset": "USDT", "free": 0.0, "locked": 0.0, "total": 0.0, "source": "NONE", "updated_at": None}


def save_cached_funding_asset(data: Dict[str, Any]) -> None:
    """Guarda el balance de la cuenta de fondos en caché local."""
    try:
        data_copy = dict(data)
        if "updated_at" not in data_copy or not data_copy["updated_at"]:
            data_copy["updated_at"] = datetime.now(timezone.utc).isoformat()
        FUNDING_CACHE_PATH.write_text(json.dumps(data_copy, indent=2), encoding="utf-8")
        try:
            os.chmod(FUNDING_CACHE_PATH, 0o600)
        except OSError:
            pass
    except Exception:
        pass


def fetch_funding_asset_balance(
    asset: str = "USDT",
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Consulta la disponibilidad de USDT en la Cuenta de Fondos de Binance (/sapi/v1/asset/get-funding-asset).
    Incluye tanto saldo libre (disponible para comerciar en P2P) como saldo bloqueado en anuncios/órdenes.
    """
    cached = get_cached_funding_asset()
    creds = get_saved_credentials()
    key = (api_key or creds["api_key"]).strip()
    secret = (api_secret or creds["api_secret"]).strip()

    if not key or not secret:
        return cached

    try:
        resp = _signed_post(
            "/sapi/v1/asset/get-funding-asset",
            params={},
            body={"asset": asset, "needBtcVal": "false"},
            api_key=key,
            api_secret=secret,
        )
        if isinstance(resp, list):
            for item in resp:
                if str(item.get("asset", "")).upper() == asset.upper():
                    free_val = float(item.get("free") or 0.0)
                    locked_val = float(item.get("locked") or 0.0)
                    freeze_val = float(item.get("freeze") or 0.0)
                    withdrawing_val = float(item.get("withdrawing") or 0.0)
                    total_locked = locked_val + freeze_val + withdrawing_val
                    total_val = free_val + total_locked
                    result = {
                        "asset": asset,
                        "free": round(free_val, 2),
                        "locked": round(total_locked, 2),
                        "total": round(total_val, 2),
                        "source": "API",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    save_cached_funding_asset(result)
                    return result

            # Si el activo no figura en la lista devuelta por Binance (saldo 0)
            result = {
                "asset": asset,
                "free": 0.0,
                "locked": 0.0,
                "total": 0.0,
                "source": "API",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            save_cached_funding_asset(result)
            return result
        return cached
    except Exception as e:
        if cached.get("total", 0) > 0 or cached.get("source") == "MANUAL":
            cached_copy = dict(cached)
            cached_copy["warning"] = str(e)
            return cached_copy
        return {
            "asset": asset,
            "free": 0.0,
            "locked": 0.0,
            "total": 0.0,
            "source": "UNAVAILABLE",
            "warning": str(e),
            "updated_at": None,
        }


def get_saved_credentials() -> Dict[str, str]:
    """Obtiene las credenciales guardadas localmente o en variables de entorno."""
    api_key = os.environ.get("BINANCE_API_KEY", "")
    api_secret = os.environ.get("BINANCE_API_SECRET", "")

    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            api_key = data.get("api_key", api_key)
            api_secret = data.get("api_secret", api_secret)
        except Exception:
            pass

    return {"api_key": api_key.strip(), "api_secret": api_secret.strip()}


def save_credentials(api_key: str, api_secret: str) -> None:
    """Guarda las credenciales localmente con permisos restringidos al usuario actual (0600)."""
    payload = {
        "api_key": api_key.strip(),
        "api_secret": api_secret.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass


def clear_credentials() -> None:
    """Elimina el archivo local de credenciales de Binance API si existe."""
    try:
        if CONFIG_PATH.exists():
            CONFIG_PATH.unlink()
    except OSError:
        pass


def _signed_get(endpoint: str, params: Dict[str, Any], api_key: str, api_secret: str) -> Dict[str, Any]:
    """Realiza una petición GET firmada con HMAC-SHA256 hacia la API de Binance."""
    params = dict(params)
    params["timestamp"] = int(time.time() * 1000)
    params["recvWindow"] = 10000

    query_string = urllib.parse.urlencode(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    url = f"{BINANCE_BASE_URL}{endpoint}?{query_string}&signature={signature}"
    req = urllib.request.Request(
        url,
        headers={
            "X-MBX-APIKEY": api_key,
            "User-Agent": "P2PLedgerLocal/1.0",
            "Content-Type": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("msg") or err_json.get("message") or err_body
            code = err_json.get("code", e.code)
            raise RuntimeError(f"Binance API Error ({code}): {msg}")
        except json.JSONDecodeError:
            raise RuntimeError(f"HTTP {e.code}: {err_body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Error de red al conectar con Binance: {e.reason}")


def _signed_post(
    endpoint: str,
    params: Dict[str, Any],
    body: Dict[str, Any],
    api_key: str,
    api_secret: str,
) -> Dict[str, Any]:
    """Realiza una petición POST firmada con HMAC-SHA256 hacia la API de Binance."""
    params = dict(params)
    params["timestamp"] = int(time.time() * 1000)
    params["recvWindow"] = 10000

    query_string = urllib.parse.urlencode(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    url = f"{BINANCE_BASE_URL}{endpoint}?{query_string}&signature={signature}"
    data_bytes = json.dumps(body or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={
            "X-MBX-APIKEY": api_key,
            "User-Agent": "P2PLedgerLocal/1.0",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("msg") or err_json.get("message") or err_body
            code = err_json.get("code", e.code)
            raise RuntimeError(f"Binance API Error ({code}): {msg}")
        except json.JSONDecodeError:
            raise RuntimeError(f"HTTP {e.code}: {err_body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Error de red al conectar con Binance: {e.reason}")


def get_cached_user_ads() -> List[Dict[str, Any]]:
    """Obtiene los anuncios del usuario guardados en caché local."""
    if USER_ADS_CACHE_PATH.exists():
        try:
            return json.loads(USER_ADS_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def save_cached_user_ads(ads: List[Dict[str, Any]]) -> None:
    """Guarda los anuncios del usuario en caché local."""
    try:
        USER_ADS_CACHE_PATH.write_text(json.dumps(ads, indent=2), encoding="utf-8")
        try:
            os.chmod(USER_ADS_CACHE_PATH, 0o600)
        except OSError:
            pass
    except Exception:
        pass


def fetch_c2c_user_ads(
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    page: int = 1,
    rows: int = 20,
) -> List[Dict[str, Any]]:
    """
    Consulta los anuncios publicados por el usuario en Binance C2C (/sapi/v1/c2c/ads/listWithPagination).
    Devuelve la lista de anuncios formateada con precio, montos disponibles, límites y estado.
    """
    creds = get_saved_credentials()
    key = (api_key or creds["api_key"]).strip()
    secret = (api_secret or creds["api_secret"]).strip()

    if not key or not secret:
        return get_cached_user_ads()

    try:
        resp = _signed_post(
            "/sapi/v1/c2c/ads/listWithPagination",
            params={},
            body={"page": page, "rows": rows},
            api_key=key,
            api_secret=secret,
        )
        raw_ads = resp.get("data") if isinstance(resp, dict) else []
        normalized_ads: List[Dict[str, Any]] = []

        for ad in raw_ads or []:
            adv_no = str(ad.get("advNo") or "").strip()
            if not adv_no:
                continue

            adv_type_raw = str(ad.get("tradeType") or ad.get("advType") or "").upper()
            adv_type = "COMPRA" if adv_type_raw == "BUY" else "VENTA"

            # Estado del anuncio: 1 = Online (Activo), 2 = Offline (Pausado), 3 = Completado/Cerrado
            status_code = str(ad.get("advStatus") or "1")
            status_label = "ACTIVO" if status_code == "1" else ("PAUSADO" if status_code == "2" else "CERRADO")

            methods = []
            for tm in ad.get("tradeMethods") or []:
                m = (
                    str(tm.get("tradeMethodName") or "").strip()
                    or str(tm.get("identifier") or "").strip()
                    or str(tm.get("payType") or "").strip()
                )
                if m and m not in methods:
                    methods.append(m)

            price = float(ad.get("price") or 0.0)
            surplus = float(ad.get("surplusAmount") or ad.get("tradableQuantity") or 0.0)
            init_amt = float(ad.get("initAmount") or 0.0)
            min_fiat = float(ad.get("minSingleTransAmount") or 0.0)
            max_fiat = float(ad.get("dynamicMaxSingleTransAmount") or ad.get("maxSingleTransAmount") or 0.0)

            normalized_ads.append({
                "adv_no": adv_no,
                "adv_type": adv_type,
                "adv_type_raw": adv_type_raw,
                "asset": str(ad.get("asset") or "USDT"),
                "fiat_unit": str(ad.get("fiatUnit") or "VES"),
                "price": price,
                "surplus_amount": surplus,
                "init_amount": init_amt,
                "min_fiat": min_fiat,
                "max_fiat": max_fiat,
                "status_code": status_code,
                "status_label": status_label,
                "is_active": status_code == "1",
                "trade_methods": methods,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

        if normalized_ads or page == 1:
            save_cached_user_ads(normalized_ads)
        return normalized_ads
    except Exception:
        return get_cached_user_ads()


def fetch_c2c_user_pay_methods(
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    fiat_unit: str = "VES",
) -> List[str]:
    """
    Consulta los anuncios del usuario en Binance C2C (/sapi/v1/c2c/ads/listWithPagination)
    para extraer exactamente los métodos de pago (bancos) que el usuario tiene configurados
    en su cuenta de Binance P2P para la moneda fiat indicada.
    """
    creds = get_saved_credentials()
    key = (api_key or creds["api_key"]).strip()
    secret = (api_secret or creds["api_secret"]).strip()

    if not key or not secret:
        return []

    resp = _signed_post(
        "/sapi/v1/c2c/ads/listWithPagination",
        params={},
        body={"page": 1, "rows": 50},
        api_key=key,
        api_secret=secret,
    )
    ads = resp.get("data") or []
    methods: List[str] = []
    seen = set()

    for ad in ads:
        ad_fiat = str(ad.get("fiatUnit") or "VES").upper().strip()
        if fiat_unit and ad_fiat != fiat_unit.upper():
            continue

        for tm in ad.get("tradeMethods") or []:
            candidate = (
                str(tm.get("tradeMethodName") or "").strip()
                or str(tm.get("identifier") or "").strip()
                or str(tm.get("payType") or "").strip()
            )
            if candidate and candidate.lower() not in seen:
                seen.add(candidate.lower())
                methods.append(candidate)

        for tm_vo in ad.get("tradeMethodCommissionRateVoList") or []:
            candidate = (
                str(tm_vo.get("tradeMethodName") or "").strip()
                or str(tm_vo.get("tradeMethodIdentifier") or "").strip()
            )
            if candidate and candidate.lower() not in seen:
                seen.add(candidate.lower())
                methods.append(candidate)

    return methods


def _normalize_c2c_item(item: Dict[str, Any], default_trade_type: str) -> Optional[Dict[str, Any]]:
    """Convierte un registro crudo de Binance C2C en el formato normalizado de P2P Ledger (incluyendo completadas y canceladas)."""
    order_no = str(item.get("orderNumber", "")).strip()
    if not order_no:
        return None

    status_str = str(item.get("orderStatus", "")).upper().strip()
    if status_str in ["COMPLETED", "4"]:
        norm_status = "COMPLETED"
    elif status_str in ["CANCELLED", "CANCELED", "6", "CANCELLED_BY_SYSTEM", "7", "EXPIRED"]:
        norm_status = "CANCELLED"
    else:
        norm_status = "IN_PROGRESS"

    create_ts = int(item.get("createTime") or 0)
    dt_str = (
        datetime.fromtimestamp(create_ts / 1000.0).strftime("%Y-%m-%d %H:%M:%S")
        if create_ts > 0
        else "-"
    )

    raw_type = str(item.get("tradeType", default_trade_type)).upper()
    order_type = "COMPRA" if raw_type == "BUY" else "VENTA"

    fiat_amount = float(item.get("totalPrice") or 0.0)
    crypto_amount = float(item.get("amount") or 0.0)
    unit_price = float(item.get("unitPrice") or 0.0)
    commission = float(item.get("commission") or 0.0) + float(item.get("takerCommission") or 0.0)

    return {
        "order_number": order_no,
        "adv_no": str(item.get("advNo") or ""),
        "order_type": order_type,
        "asset": str(item.get("asset") or "USDT"),
        "fiat_currency": str(item.get("fiat") or "VES"),
        "fiat_amount": fiat_amount,
        "crypto_amount": crypto_amount,
        "unit_price": unit_price,
        "commission_usdt": commission,
        "pay_method": str(item.get("payMethodName") or "Transferencia Bancaria"),
        "counterparty": str(item.get("counterPartNickName") or "-"),
        "create_timestamp": create_ts,
        "order_date": dt_str,
        "order_status": norm_status,
        "source": "API",
    }


def fetch_c2c_orders_range(
    start_ms: int,
    end_ms: int,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Descarga el historial completo de órdenes P2P (BUY y SELL) desde Binance C2C API.
    - Recorre desde la fecha más reciente hacia atrás en ventanas de 15 días (compatible con el tope de 30 días de Binance).
    - Recorre todas las páginas de cada ventana (Binance devuelve hasta 50-100 registros por página)
      y aplica retroceso por timestamp (cursor) si una ventana supera el límite de paginación.
    """
    creds = get_saved_credentials()
    key = (api_key or creds["api_key"]).strip()
    secret = (api_secret or creds["api_secret"]).strip()

    if not key or not secret:
        raise ValueError("No se han configurado las credenciales de Binance API (API Key y Secret Key).")

    # Usamos ventanas de 15 días caminando desde hoy hacia atrás:
    # 6 ventanas cubren 90 días exactos sin cruzar el borde, y 12 ventanas cubren 180 días (6 meses).
    WINDOW_MS = 15 * 24 * 60 * 60 * 1000
    normalized_orders: Dict[str, Dict[str, Any]] = {}

    cur_end = end_ms
    stop_older_windows = False

    while cur_end > start_ms and not stop_older_windows:
        cur_start = max(start_ms, cur_end - WINDOW_MS)

        for trade_type in ["BUY", "SELL"]:
            cursor_end = cur_end
            seen_raw_orders_in_window = set()

            while cursor_end >= cur_start:
                page = 1
                subwindow_raw_count = 0
                oldest_ts_in_subwindow: Optional[int] = None
                need_cursor_shift = False

                while True:
                    params = {
                        "tradeType": trade_type,
                        "startTimestamp": cur_start,
                        "endTimestamp": cursor_end,
                        "page": page,
                        "rows": 100,
                    }
                    try:
                        resp = _signed_get("/sapi/v1/c2c/orderMatch/listUserOrderHistory", params, key, secret)
                    except RuntimeError as err:
                        # Si llegamos al límite histórico permitido por Binance API (ej. > 6 meses o > 90d según cuenta),
                        # detenemos la búsqueda hacia atrás conservando todas las órdenes ya descargadas.
                        err_msg = str(err).lower()
                        if any(tok in err_msg for tok in ["month", "time", "interval", "days", "range", "-11", "90"]):
                            stop_older_windows = True
                            break
                        raise

                    items = resp.get("data") or []
                    total_reported = int(resp.get("total") or 0)

                    if not items:
                        if page > 1 and total_reported > subwindow_raw_count and oldest_ts_in_subwindow and oldest_ts_in_subwindow > cur_start:
                            need_cursor_shift = True
                        break

                    new_raw_in_page = 0
                    for item in items:
                        raw_no = str(item.get("orderNumber", "")).strip()
                        if raw_no and raw_no not in seen_raw_orders_in_window:
                            seen_raw_orders_in_window.add(raw_no)
                            new_raw_in_page += 1

                        item_ts = int(item.get("createTime") or 0)
                        if item_ts > 0:
                            if oldest_ts_in_subwindow is None or item_ts < oldest_ts_in_subwindow:
                                oldest_ts_in_subwindow = item_ts

                        norm = _normalize_c2c_item(item, trade_type)
                        if norm:
                            normalized_orders[norm["order_number"]] = norm

                    subwindow_raw_count += len(items)

                    # Si la página repitió registros ya vistos, usamos el cursor por timestamp para avanzar hacia atrás
                    if new_raw_in_page == 0:
                        if oldest_ts_in_subwindow and oldest_ts_in_subwindow > cur_start:
                            need_cursor_shift = True
                        break

                    # Si Binance reporta total y ya alcanzamos o superamos ese total
                    if total_reported > 0 and subwindow_raw_count >= total_reported:
                        if total_reported >= 100 and oldest_ts_in_subwindow and oldest_ts_in_subwindow > cur_start:
                            need_cursor_shift = True
                        break

                    # Si devolvió menos registros que el tamaño de página de Binance (50), es la última página de la ventana
                    if len(items) < 50:
                        break

                    page += 1
                    time.sleep(0.08)

                if stop_older_windows:
                    break

                if (
                    need_cursor_shift
                    and oldest_ts_in_subwindow
                    and oldest_ts_in_subwindow > cur_start
                    and cursor_end > oldest_ts_in_subwindow - 1
                ):
                    cursor_end = oldest_ts_in_subwindow - 1
                else:
                    break

        cur_end = cur_start - 1

    return sorted(normalized_orders.values(), key=lambda x: x["create_timestamp"], reverse=True)

