from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from .config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_auth(api_key: str = Security(api_key_header)):
    """
    Middleware/dependencia de autenticación por API Key.
    - Si REQUIRE_AUTH es False (desarrollo por defecto), permite el paso sin validar.
    - Si REQUIRE_AUTH es True (modo producción o activado en .env), exige una clave válida.
    """
    if not settings.REQUIRE_AUTH:
        return True

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el encabezado de autenticación X-API-Key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if api_key != settings.API_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Credenciales de acceso inválidas.",
        )

    return True
