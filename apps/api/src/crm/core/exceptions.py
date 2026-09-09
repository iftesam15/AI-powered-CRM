"""Application exceptions and the handlers that shape the HTTP error body.

One error shape for the whole API, per CRM_ARCHITECTURE.md section 7. The web
app's `types/api.ts` mirrors it, so changing this changes a contract.
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base class for expected, reportable failures."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"
    detail: str = "The request could not be completed."

    def __init__(self, detail: str | None = None, *, code: str | None = None) -> None:
        if detail is not None:
            self.detail = detail
        if code is not None:
            self.code = code
        super().__init__(self.detail)


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"
    detail = "Email or password is incorrect."


class AccountLockedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "account_locked"
    detail = "Too many failed attempts. Account is temporarily locked."


class AccountInactiveError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "account_inactive"
    detail = "This account has been deactivated. Contact your administrator."


class InvalidTokenError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_token"
    detail = "This reset link is not valid."


class TokenExpiredError(AppError):
    status_code = status.HTTP_410_GONE
    code = "token_expired"
    detail = "This reset link has expired. Request a new one."


class TokenAlreadyUsedError(AppError):
    status_code = status.HTTP_410_GONE
    code = "token_used"
    detail = "This reset link has already been used. Request a new one."


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    detail = "The requested resource does not exist."


class PermissionDeniedError(AppError):
    """Also used for cross-tenant access.

    Answering 404 versus 403 differently would let a caller probe whether an id
    exists in another tenant, so both resolve to the same response.
    """

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    detail = "You do not have access to this resource."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    detail = "That change conflicts with the current state."


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "validation_error"
    detail = "Validation failed."


def _body(detail: str, code: str, **extra: Any) -> dict[str, Any]:
    return {"detail": detail, "code": code, **extra}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_body(exc.detail, exc.code))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(str(exc.detail), "http_error"),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        field_errors: dict[str, list[str]] = {}
        for error in exc.errors():
            # Drop the leading "body"/"query" segment so the key matches the
            # field name the form on the web side knows.
            location = [str(part) for part in error["loc"][1:]] or [str(error["loc"][0])]
            field_errors.setdefault(".".join(location), []).append(error["msg"])

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body(
                "Check the details you entered.",
                "validation_error",
                fieldErrors=field_errors,
            ),
        )
