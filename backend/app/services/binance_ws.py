"""
Servicio en segundo plano que escucha el WebSocket User Data Stream de Binance.
En cuanto detecta un cambio en el balance de la cuenta (outboundAccountPosition, balanceUpdate),
dispara automáticamente la sincronización incremental de órdenes C2C en segundo plano.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import threading
import time
from typing import Optional, Callable
import websockets

from .binance_api import get_saved_credentials

logger = logging.getLogger("p2p_ws_stream")

WS_API_URL = "wss://ws-api.binance.com:443/ws-api/v3"

class BinanceUserDataStreamClient:
    def __init__(self, on_balance_change: Optional[Callable[[], None]] = None, debounce_seconds: float = 3.0):
        self.on_balance_change = on_balance_change
        self.debounce_seconds = debounce_seconds
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.last_event_time: Optional[float] = None
        self._last_trigger_time: float = 0.0
        self.connection_status = "DISCONNECTED"

    def start(self):
        """Inicia el cliente WebSocket en un hilo daemon en segundo plano."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="BinanceWSStream")
        self._thread.start()

    def stop(self):
        """Detiene el cliente WebSocket."""
        self.is_running = False
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)

    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._listen_worker())

    async def _listen_worker(self):
        backoff = 2
        while self.is_running:
            creds = get_saved_credentials()
            api_key = creds.get("api_key", "").strip()
            api_secret = creds.get("api_secret", "").strip()

            if not api_key or not api_secret:
                self.connection_status = "NO_CREDENTIALS"
                await asyncio.sleep(5)
                continue

            try:
                self.connection_status = "CONNECTING"
                async with websockets.connect(
                    WS_API_URL,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    ts = int(time.time() * 1000)
                    qs = f"apiKey={api_key}&timestamp={ts}"
                    sig = hmac.new(
                        api_secret.encode("utf-8"),
                        qs.encode("utf-8"),
                        hashlib.sha256,
                    ).hexdigest()

                    req = {
                        "id": f"sub-{ts}",
                        "method": "userDataStream.subscribe.signature",
                        "params": {
                            "apiKey": api_key,
                            "timestamp": ts,
                            "signature": sig,
                        },
                    }
                    await ws.send(json.dumps(req))
                    sub_ack = await asyncio.wait_for(ws.recv(), timeout=10.0)
                    sub_data = json.loads(sub_ack)

                    if sub_data.get("status") == 200:
                        self.connection_status = "CONNECTED"
                        backoff = 2  # Reset backoff on success
                    else:
                        self.connection_status = "AUTH_FAILED"
                        await asyncio.sleep(10)
                        continue

                    # Bucle continuo de escucha de eventos
                    while self.is_running:
                        msg_raw = await ws.recv()
                        msg = json.loads(msg_raw)
                        event_type = msg.get("e") or (msg.get("data", {}).get("e") if isinstance(msg.get("data"), dict) else None)

                        # Eventos de interés: cambio de balance o transferencia de fondos
                        # outboundAccountPosition: cambio en balance libre o bloqueado en Spot
                        # balanceUpdate: depósitos/retiros o transferencias internas entre billeteras
                        if event_type in ["outboundAccountPosition", "balanceUpdate"]:
                            now = time.time()
                            self.last_event_time = now
                            if self.on_balance_change:
                                if now - self._last_trigger_time >= self.debounce_seconds:
                                    self._last_trigger_time = now
                                    try:
                                        logger.info("Evento de balance recibido en WS (%s). Disparando sincronización...", event_type)
                                        self.on_balance_change()
                                    except Exception as cb_err:
                                        logger.error(f"Error al ejecutar trigger de balance: {cb_err}")
                                else:
                                    logger.debug("Evento de balance %s ignorado por debounce activo.", event_type)

            except (websockets.ConnectionClosed, asyncio.TimeoutError, OSError) as net_err:
                self.connection_status = "RECONNECTING"
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)
            except Exception as e:
                self.connection_status = "ERROR"
                await asyncio.sleep(10)
