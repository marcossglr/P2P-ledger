from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, ForeignKey
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


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)         # Ej: "Banesco", "Mercantil", "Banco Provincial"
    account_alias = Column(String, default="")             # Ej: "Cuenta Principal / 0134"
    fiat_currency = Column(String, default="VES")
    match_keywords = Column(String, default="")            # Palabras clave separadas por coma: "banesco"
    is_default = Column(Integer, default=0)                # 1 si recibe órdenes genéricas ("Pago Móvil")
    apply_buy_fee = Column(Integer, default=1)             # 1 si descuenta comisión bancaria en COMPRAS (salidas Bs)
    pago_movil_fee_pct = Column(Float, default=0.3)        # % comisión cuando pay_method incluye Pago Móvil
    transfer_fee_pct = Column(Float, default=0.0)          # % comisión en transferencias regulares
    anchor_balance = Column(Float, default=0.0)            # Saldo base fijado en el último cuadre o saldo inicial
    anchor_timestamp = Column(BigInteger, default=0)       # Epoch ms desde el cual las órdenes suman/restan
    anchor_date_label = Column(String, default="Inicio")   # Etiqueta de fecha/hora del último cuadre
    manual_delta_bs = Column(Float, default=0.0)           # Movimientos manuales netos desde el último cuadre
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
