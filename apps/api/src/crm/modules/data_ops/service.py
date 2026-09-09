"""Data operations service for CSV import and export."""

import csv
import io
from typing import Any
from uuid import UUID

from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import ValidationError
from crm.modules.accounts.repository import AccountRepository
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext
from crm.modules.contacts.models import Contact
from crm.modules.contacts.repository import ContactRepository
from crm.modules.data_ops.schemas import (
    ACCOUNT_IMPORT_TEMPLATE_ROWS,
    ACCOUNT_IMPORTABLE_FIELDS,
    CONTACT_IMPORT_TEMPLATE_ROWS,
    CONTACT_IMPORTABLE_FIELDS,
    LEAD_IMPORT_TEMPLATE_ROWS,
    LEAD_IMPORTABLE_FIELDS,
    ColumnMapping,
    FieldOption,
    ImportFieldsResponse,
    ImportPreviewResponse,
    ImportPreviewRow,
    ImportResult,
    ImportRowError,
)
from crm.modules.leads.repository import LeadRepository
from crm.modules.opportunities.repository import OpportunityRepository
from crm.modules.users.models import User


class DataOpsService:
    """Service for handling CSV import preview/execute and CSV export."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.contact_repo = ContactRepository(session)
        self.account_repo = AccountRepository(session)
        self.lead_repo = LeadRepository(session)
        self.opportunity_repo = OpportunityRepository(session)
        self.audit = AuditService(session)

    def _import_schema(
        self, entity_type: str
    ) -> tuple[dict[str, str], list[dict[str, str]]]:
        """Return (field_key → header label, sample template rows) for an entity."""
        if entity_type == "contacts":
            return CONTACT_IMPORTABLE_FIELDS, CONTACT_IMPORT_TEMPLATE_ROWS
        if entity_type == "accounts":
            return ACCOUNT_IMPORTABLE_FIELDS, ACCOUNT_IMPORT_TEMPLATE_ROWS
        if entity_type == "leads":
            return LEAD_IMPORTABLE_FIELDS, LEAD_IMPORT_TEMPLATE_ROWS
        raise ValidationError(f"Unsupported entity type for import: {entity_type}")

    def get_importable_fields(self, entity_type: str) -> ImportFieldsResponse:
        """Get allowed import fields for a given entity type."""
        fields_map, _ = self._import_schema(entity_type)
        options = [
            FieldOption(value=key, label=label)
            for key, label in fields_map.items()
        ]
        return ImportFieldsResponse(entity_type=entity_type, fields=options)

    def build_import_template_csv(self, entity_type: str) -> str:
        """Build a UTF-8 CSV template whose headers match the import schema."""
        fields_map, sample_rows = self._import_schema(entity_type)
        headers = list(fields_map.values())

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in sample_rows:
            writer.writerow({header: row.get(header, "") for header in headers})
        return output.getvalue()

    def preview_csv(self, csv_content: str) -> ImportPreviewResponse:
        """Parse CSV content and return headers, sample rows, and total row count."""
        f = io.StringIO(csv_content.strip())
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            raise ValidationError("CSV file is empty.")

        # Clean headers (strip quotes / whitespace)
        headers = [h.strip() for h in headers if h.strip()]
        if not headers:
            raise ValidationError("CSV file contains no valid header columns.")

        f.seek(0)
        dict_reader = csv.DictReader(f)
        sample_rows: list[ImportPreviewRow] = []
        total_rows = 0

        for row in dict_reader:
            total_rows += 1
            if len(sample_rows) < 5:
                clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
                sample_rows.append(ImportPreviewRow(values=clean_row))

        return ImportPreviewResponse(
            headers=headers,
            sample_rows=sample_rows,
            total_rows=total_rows,
        )

    async def import_contacts(
        self,
        actor: User,
        csv_content: str,
        column_mapping: ColumnMapping,
        context: RequestContext | None = None,
    ) -> ImportResult:
        """Execute CSV import for contacts using column mapping."""
        mapping = column_mapping.mapping  # CSV header -> Contact field name
        f = io.StringIO(csv_content.strip())
        reader = csv.DictReader(f)

        created_count = 0
        error_count = 0
        errors: list[ImportRowError] = []
        row_index = 0

        for row in reader:
            row_index += 1
            # Clean values
            clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}

            # Extract fields based on mapping
            contact_data: dict[str, Any] = {}
            for csv_header, crm_field in mapping.items():
                if csv_header in clean_row and crm_field in CONTACT_IMPORTABLE_FIELDS:
                    val = clean_row[csv_header]
                    if val:
                        contact_data[crm_field] = val

            # Validate required fields
            first_name = contact_data.get("first_name", "")
            last_name = contact_data.get("last_name", "")

            if not first_name and not last_name:
                error_count += 1
                errors.append(
                    ImportRowError(
                        row=row_index,
                        field="first_name/last_name",
                        message="Row must have at least a first name or last name.",
                    )
                )
                continue

            # Default empty strings to reasonable fallback if one is missing
            if not first_name:
                first_name = last_name
            if not last_name:
                last_name = "N/A"

            contact = Contact(
                tenant_id=actor.tenant_id,
                first_name=first_name,
                last_name=last_name,
                email=contact_data.get("email"),
                phone=contact_data.get("phone"),
                title=contact_data.get("title"),
                owner_id=actor.id,
            )
            self.session.add(contact)
            created_count += 1

        await self.session.flush()

        # Audit recording
        self.audit.record(
            tenant_id=actor.tenant_id,
            actor=actor,
            context=context,
            action=AuditAction.IMPORT_COMPLETED if hasattr(AuditAction, "IMPORT_COMPLETED") else AuditAction.CONTACT_CREATED,
            entity_type=AuditEntity.CONTACT,
            entity_id=actor.id,
            summary=f"Imported {created_count} contacts from CSV ({error_count} errors)",
            changes={"imported_count": created_count, "error_count": error_count},
        )

        return ImportResult(
            entity_type="contacts",
            total_rows=row_index,
            created_count=created_count,
            error_count=error_count,
            errors=errors,
        )

    async def export_contacts_csv(self, tenant_id: UUID) -> str:
        """Generate CSV string of all contacts in tenant."""
        contacts = await self.contact_repo.list_contacts(
            tenant_id=tenant_id,
            limit=10000,
            offset=0,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["First Name", "Last Name", "Email", "Phone", "Job Title", "Account Name", "Created At"])

        for c in contacts:
            account_name = c.account.name if c.account else ""
            created_at = c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else ""
            writer.writerow([
                c.first_name,
                c.last_name,
                c.email or "",
                c.phone or "",
                c.title or "",
                account_name,
                created_at,
            ])

        return output.getvalue()

    async def export_accounts_csv(self, tenant_id: UUID) -> str:
        """Generate CSV string of all accounts in tenant."""
        accounts = await self.account_repo.list_accounts(
            tenant_id=tenant_id,
            limit=10000,
            offset=0,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Company Name", "Industry", "Size", "Website", "Address", "Created At"])

        for a in accounts:
            created_at = a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else ""
            writer.writerow([
                a.name,
                a.industry or "",
                a.size or "",
                a.website or "",
                a.address or "",
                created_at,
            ])

        return output.getvalue()

    async def export_leads_csv(self, tenant_id: UUID) -> str:
        """Generate CSV string of all leads in tenant."""
        leads = await self.lead_repo.list_leads(
            tenant_id=tenant_id,
            limit=10000,
            offset=0,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["First Name", "Last Name", "Email", "Phone", "Company Name", "Title", "Status", "Source", "Created At"])

        for l in leads:
            created_at = l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else ""
            writer.writerow([
                l.first_name,
                l.last_name,
                l.email or "",
                l.phone or "",
                l.company_name or "",
                l.title or "",
                l.status.value if hasattr(l.status, "value") else str(l.status),
                l.source or "",
                created_at,
            ])

        return output.getvalue()

    async def export_opportunities_csv(self, tenant_id: UUID) -> str:
        """Generate CSV string of all opportunities in tenant."""
        opps = await self.opportunity_repo.list_opportunities(
            tenant_id=tenant_id,
            limit=10000,
            offset=0,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Opportunity Title", "Account Name", "Amount", "Stage", "Expected Close Date", "Created At"])

        for o in opps:
            account_name = o.account.name if o.account else ""
            created_at = o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else ""
            expected_close = o.expected_close_date.strftime("%Y-%m-%d") if o.expected_close_date else ""
            stage_name = o.stage.name if o.stage else ""
            writer.writerow([
                o.title,
                account_name,
                str(o.amount) if o.amount is not None else "",
                stage_name,
                expected_close,
                created_at,
            ])

        return output.getvalue()
