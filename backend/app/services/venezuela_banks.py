"""
Módulo legado de compatibilidad hacia atrás.
Redirige al nuevo Registro y Enriquecedor Universal de Métodos de Pago Multifiat (payment_methods_registry.py).
"""

from .payment_methods_registry import (
    VES_PROVIDERS as VENEZUELA_BANKS_CATALOG,
    find_bank_in_catalog,
    resolve_payment_method_metadata,
)

__all__ = [
    "VENEZUELA_BANKS_CATALOG",
    "find_bank_in_catalog",
    "resolve_payment_method_metadata",
]
