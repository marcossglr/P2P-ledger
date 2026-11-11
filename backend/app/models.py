from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, ForeignKey, Index
from .database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, index=True)  # "BINANCE_API", "BINANCE_CSV", "BANK_PDF"
    filename = Column(String)
    total_rows = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


class BinanceOrder(Base):
    __tablename__ = "binance_orders"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("upload_batches.id"), nullable=True)
    order_number = Column(String, unique=True, index=True)
    adv_no = Column(String, nullable=True)
    order_type = Column(String, index=True)       # "COMPRA" / "VENTA"
    asset = Column(String, default="USDT")        # "USDT", "BTC", etc.
    fiat_currency = Column(String, default="VES", index=True)
    fiat_amount = Column(Float, default=0.0)      # Total Fiat
    crypto_amount = Column(Float, default=0.0)    # Cantidad USDT bruta
    unit_price = Column(Float, default=0.0)       # Tasa / Precio unitario
    commission_usdt = Column(Float, default=0.0)  # Comisión Binance P2P en USDT
    pay_method = Column(String, nullable=True)    # Banco / Método de pago reportado
    counterparty = Column(String, nullable=True)  # Nickname de la contraparte
    reference_note = Column(String, nullable=True)
    create_timestamp = Column(BigInteger, index=True, default=0)  # Epoch ms
    order_date = Column(String, index=True)       # YYYY-MM-DD HH:MM:SS
    order_status = Column(String, default="COMPLETED", index=True)  # "COMPLETED", "CANCELLED", "IN_PROGRESS"
    source = Column(String, default="API")        # "API", "CSV", "DEMO"
    status = Column(String, default="UNMATCHED")  # Estado de conciliación bancaria
    bank_account_id = Column(Integer, nullable=True, index=True)  # Asignación explícita opcional a cuenta bancaria
    payment_channel = Column(String, nullable=True, index=True)   # "PAGO_MOVIL" (cobra comisión) | "TRANSFERENCIA" (mismo banco, 0%)
    payment_channel_manual = Column(Integer, default=0)           # 1 si el canal fue fijado manualmente por el usuario

    __table_args__ = (
        Index("idx_orders_fiat_status_ts", "fiat_currency", "order_status", "create_timestamp"),
        Index("idx_orders_fiat_status_date", "fiat_currency", "order_status", "order_date"),
        Index("idx_orders_fiat_bank_date", "fiat_currency", "bank_account_id", "order_date"),
        Index("idx_orders_grouping_perf", "fiat_currency", "order_status", "bank_account_id", "pay_method"),
    )


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    # --- Atributos Nativos Binance P2P (Simetría 100%) ---
    binance_pay_id = Column(String, index=True, default="")         # payId (Ej: "77364173")
    pay_method_identifier = Column(String, index=True, default="")  # identifier (Ej: "BancoDeVenezuela", "Bancamiga", "Zelle")
    name = Column(String, index=True)                              # tradeMethodName (Ej: "Banco de Venezuela", "Bancamiga")
    fiat_currency = Column(String, default="VES", index=True)       # Divisa asociada (VES, USD, COP, etc.)
    is_active = Column(Integer, default=1)                         # 1 si sigue activo en Binance, 0 si fue desvinculado

    # --- Atributos de Auditoría y Conciliación Contable Ledger ---
    account_alias = Column(String, default="")                     # Alias operativo (opcional para el operador)
    match_keywords = Column(String, default="")                    # Palabras clave de vinculación P2P
    is_default = Column(Integer, default=0)                        # 1 si es cuenta principal de recepción
    apply_buy_fee = Column(Integer, default=1)                     # 1 si descuenta comisión bancaria en COMPRAS
    pago_movil_fee_pct = Column(Float, default=0.3)                # % comisión en salidas interbancarias / Pago Móvil
    transfer_fee_pct = Column(Float, default=0.0)                  # % comisión en transferencias regulares

    # --- Puntos de Anclaje de Saldo (Arqueo / Cuadre) ---
    anchor_balance = Column(Float, default=0.0)                    # Saldo base fijado en el último cuadre
    anchor_timestamp = Column(BigInteger, default=0)               # Timestamp ms desde el cual las órdenes suman/restan
    anchor_date_label = Column(String, default="Inicio")           # Etiqueta de fecha/hora del último cuadre
    manual_delta_bs = Column(Float, default=0.0)                   # Movimientos manuales netos desde el último cuadre
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class BankBalanceAdjustment(Base):
    __tablename__ = "bank_balance_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), index=True)
    account_name = Column(String)
    adjustment_type = Column(String, index=True)  # "CUADRE_CONSOLIDADO", "SALDO_INICIAL_DIA", "SALDO_INICIAL_HISTORICO", "MOVIMIENTO_MANUAL"
    previous_balance = Column(Float, default=0.0)
    new_balance = Column(Float, default=0.0)
    delta_amount = Column(Float, default=0.0)     # Diferencia (Descuadre o monto manual sumado/restado)
    note = Column(String, default="")
    created_at_str = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.now)


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("upload_batches.id"), nullable=True)
    tx_date = Column(String, index=True)
    reference = Column(String, index=True)
    description = Column(String)
    debit = Column(Float, default=0.0)   # Salidas
    credit = Column(Float, default=0.0)  # Entradas
    balance = Column(Float, default=0.0)
    matched_order_number = Column(String, nullable=True)
    status = Column(String, default="UNMATCHED")

