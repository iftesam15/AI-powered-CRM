"""Data-ops HTTP router for CSV import and export."""

import json
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import (
    CurrentTenant,
    RequestContextDep,
    require_permission,
)
from crm.core.exceptions import ValidationError
from crm.core.rbac import Permission
from crm.modules.data_ops.schemas import (
    ColumnMapping,
    ImportFieldsResponse,
    ImportPreviewResponse,
    ImportResult,
)
from crm.modules.data_ops.service import DataOpsService
from crm.modules.users.models import User

router = APIRouter(prefix="/data-ops", tags=["data-ops"])

ImportAccess = Annotated[User, Depends(require_permission(Permission.IMPORTS_WRITE))]
ExportAccess = Annotated[User, Depends(require_permission(Permission.EXPORTS_READ))]


@router.get(
    "/import/fields/{entity_type}",
    response_model=ImportFieldsResponse,
    summary="Get importable field options for an entity type",
)
async def get_import_fields(
    _: ImportAccess,
    entity_type: str,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ImportFieldsResponse:
    service = DataOpsService(session)
    return service.get_importable_fields(entity_type)


@router.get(
    "/import/template/{entity_type}",
    summary="Download a CSV import template matching the entity schema",
)
async def download_import_template(
    _: ImportAccess,
    entity_type: str,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    service = DataOpsService(session)
    csv_data = service.build_import_template_csv(entity_type)
    filename = f"{entity_type}_import_template.csv"
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/import/preview",
    response_model=ImportPreviewResponse,
    summary="Upload CSV file to preview column headers and sample data",
)
async def preview_import(
    _: ImportAccess,
    file: UploadFile = File(...),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ImportPreviewResponse:
    service = DataOpsService(session)
    content_bytes = await file.read()
    try:
        csv_text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValidationError("File must be valid UTF-8 encoded text or CSV.")

    return service.preview_csv(csv_text)


@router.post(
    "/import/execute/{entity_type}",
    response_model=ImportResult,
    summary="Execute CSV import with column mapping",
)
async def execute_import(
    actor: ImportAccess,
    entity_type: str,
    file: UploadFile = File(...),
    mapping_json: str = Form(..., description="JSON string of header-to-field mapping"),
    context: RequestContextDep = None,
    session: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ImportResult:
    if entity_type != "contacts":
        raise ValidationError(f"Importing entity '{entity_type}' is not yet supported. Only 'contacts' is supported.")

    try:
        mapping_dict = json.loads(mapping_json)
        column_mapping = ColumnMapping(mapping=mapping_dict)
    except Exception as e:
        raise ValidationError(f"Invalid column mapping JSON format: {e}")

    content_bytes = await file.read()
    try:
        csv_text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValidationError("File must be valid UTF-8 encoded text or CSV.")

    service = DataOpsService(session)
    result = await service.import_contacts(
        actor=actor,
        csv_content=csv_text,
        column_mapping=column_mapping,
        context=context,
    )
    await session.commit()
    return result


@router.get(
    "/export/{entity_type}",
    summary="Export entity data to CSV",
)
async def export_entity_csv(
    _: ExportAccess,
    entity_type: str,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    service = DataOpsService(session)

    if entity_type == "contacts":
        csv_data = await service.export_contacts_csv(tenant.id)
    elif entity_type == "accounts":
        csv_data = await service.export_accounts_csv(tenant.id)
    elif entity_type == "leads":
        csv_data = await service.export_leads_csv(tenant.id)
    elif entity_type == "opportunities":
        csv_data = await service.export_opportunities_csv(tenant.id)
    else:
        raise ValidationError(f"Export for entity '{entity_type}' is not supported.")

    filename = f"{entity_type}_export.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
