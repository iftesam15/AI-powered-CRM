"""Search Pydantic schemas for cross-entity global search."""

from uuid import UUID

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    """Single search hit: one row from any entity table."""

    entity_type: str = Field(description="account | contact | lead | opportunity")
    id: UUID
    title: str = Field(description="Display name / headline of the result.")
    subtitle: str | None = Field(
        default=None, description="Secondary descriptor (email, company, etc.)"
    )
    url: str = Field(
        description="Client-side path, e.g. /accounts/<id>. Ready for Next router."
    )


class SearchResponse(BaseModel):
    """Envelope returned by GET /search."""

    items: list[SearchResult] = Field(default_factory=list)
    total: int = Field(description="Total hits across all entity types.")
    query: str = Field(description="Echo back the normalised query.")
