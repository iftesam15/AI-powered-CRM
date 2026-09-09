"""Data-ops Pydantic schemas for CSV import and export."""

from pydantic import BaseModel, Field


class ImportPreviewRow(BaseModel):
    """One row of a CSV preview."""

    values: dict[str, str] = Field(description="Header → cell-value map.")


class ImportPreviewResponse(BaseModel):
    """Returned by the preview endpoint before the user commits the import."""

    headers: list[str] = Field(description="Detected CSV column headers.")
    sample_rows: list[ImportPreviewRow] = Field(
        default_factory=list,
        description="First N rows for column-mapping UI.",
    )
    total_rows: int = Field(description="Total data rows (excluding header).")


class ImportRowError(BaseModel):
    """One validation failure on a single import row."""

    row: int = Field(description="1-based row index in the CSV.")
    field: str = Field(description="Column / field that failed.")
    message: str


class ImportResult(BaseModel):
    """Summary returned after a completed import."""

    entity_type: str
    total_rows: int
    created_count: int
    error_count: int
    errors: list[ImportRowError] = Field(default_factory=list)


# ---- Column mapping sent by the frontend ------------------------------------

class ColumnMapping(BaseModel):
    """Maps CSV header names to CRM model field names."""

    mapping: dict[str, str] = Field(
        description=(
            "Keys are CSV column headers, values are CRM field names. "
            "Un-mapped columns are ignored."
        ),
    )


# ---- Available fields for mapping UI ----------------------------------------

CONTACT_IMPORTABLE_FIELDS: dict[str, str] = {
    "first_name": "First Name",
    "last_name": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "title": "Job Title",
}

# Sample rows for the downloadable import template (header labels → values).
CONTACT_IMPORT_TEMPLATE_ROWS: list[dict[str, str]] = [
    {
        "First Name": "Jordan",
        "Last Name": "Lee",
        "Email": "jordan.lee@example.com",
        "Phone": "+1-555-0100",
        "Job Title": "Operations Manager",
    },
    {
        "First Name": "Sam",
        "Last Name": "Rivera",
        "Email": "sam.rivera@example.com",
        "Phone": "+1-555-0101",
        "Job Title": "Procurement Lead",
    },
]

ACCOUNT_IMPORTABLE_FIELDS: dict[str, str] = {
    "name": "Company Name",
    "industry": "Industry",
    "size": "Size",
    "website": "Website",
    "address": "Address",
}

ACCOUNT_IMPORT_TEMPLATE_ROWS: list[dict[str, str]] = [
    {
        "Company Name": "Acme Logistics",
        "Industry": "Transportation",
        "Size": "51-200",
        "Website": "https://acme.example.com",
        "Address": "100 Harbor Way, Seattle, WA",
    },
]

LEAD_IMPORTABLE_FIELDS: dict[str, str] = {
    "first_name": "First Name",
    "last_name": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "company_name": "Company Name",
    "title": "Job Title",
    "source": "Source",
    "notes": "Notes",
}

LEAD_IMPORT_TEMPLATE_ROWS: list[dict[str, str]] = [
    {
        "First Name": "Alex",
        "Last Name": "Nguyen",
        "Email": "alex.nguyen@example.com",
        "Phone": "+1-555-0200",
        "Company Name": "Northwind Freight",
        "Job Title": "Fleet Director",
        "Source": "Website",
        "Notes": "Requested a demo",
    },
]


class FieldOption(BaseModel):
    value: str
    label: str


class ImportFieldsResponse(BaseModel):
    entity_type: str
    fields: list[FieldOption]
