from typing import Optional, List
from pydantic import BaseModel


class CredentialsPayload(BaseModel):
    api_key: str
    api_secret: str


class SyncPayload(BaseModel):
    force_full_90d: bool = False
    force_full_180d: bool = False
    days: Optional[int] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


class ManualMatchPayload(BaseModel):
    order_id: int
    bank_id: int


class BankAccountPayload(BaseModel):
    name: str
    account_alias: Optional[str] = ""
    bank_code: Optional[str] = ""
    account_number: Optional[str] = ""
    holder_name: Optional[str] = ""
    holder_id: Optional[str] = ""
    phone_number: Optional[str] = ""
    match_keywords: Optional[str] = ""
    is_default: bool = False
    apply_buy_fee: bool = True
    pago_movil_fee_pct: float = 0.3
    transfer_fee_pct: float = 0.0
    initial_balance: Optional[float] = None


class BankReconcilePayload(BaseModel):
    account_id: int
    mode: str = "CUADRE_CONSOLIDADO"  # "CUADRE_CONSOLIDADO", "SALDO_INICIAL_DIA", "SALDO_INICIAL_HISTORICO", "MOVIMIENTO_MANUAL"
    amount: float
    note: Optional[str] = ""


class BulkBankReconcileItem(BaseModel):
    account_id: int
    real_balance: float


class BulkBankReconcilePayload(BaseModel):
    items: List[BulkBankReconcileItem]
    mode: str = "CUADRE_CONSOLIDADO"
    note: Optional[str] = ""


class AssignOrderBankPayload(BaseModel):
    order_id: int
    bank_account_id: Optional[int] = None


class UpdatePaymentChannelPayload(BaseModel):
    order_id: int
    payment_channel: str  # "PAGO_MOVIL" | "TRANSFERENCIA"


class FundingManualPayload(BaseModel):
    free: float = 0.0
    locked: float = 0.0


class P2PPublicConfigPayload(BaseModel):
    enabled: Optional[bool] = None
    asset: Optional[str] = None
    fiat: Optional[str] = None
    pay_types: Optional[List[str]] = None
    trans_amount: Optional[float] = None
    rows: Optional[int] = None
    pages: Optional[int] = None
    publisher_type: Optional[str] = None
    top_n: Optional[int] = None
    refresh_interval_seconds: Optional[int] = None
