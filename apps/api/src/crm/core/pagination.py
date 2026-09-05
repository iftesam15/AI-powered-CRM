"""List pagination: one query-parameter shape and one response envelope.

Every list endpoint from sprint 2 onward returns `Page[T]`, so the web app has
a single result shape to render and a new module never invents its own.

Offset paging, not keyset. At seed and small-tenant volume the cost of `OFFSET`
is irrelevant, and offsets let the UI jump to an arbitrary page. `total` is a
real `COUNT`, so it is honest about how many rows a filter matched. If a list
ever grows past a few thousand rows per tenant, this is the seam to swap for a
cursor without touching the routers.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from pydantic import BaseModel, Field

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


@dataclass(frozen=True, slots=True)
class PageParams:
    """Validated `limit`/`offset` pair, injected into list routes."""

    limit: int
    offset: int


def get_page_params(
    limit: Annotated[
        int,
        Query(ge=1, le=MAX_LIMIT, description="Rows per page."),
    ] = DEFAULT_LIMIT,
    offset: Annotated[
        int,
        Query(ge=0, description="Rows to skip before the first result."),
    ] = 0,
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


PageParamsDep = Annotated[PageParams, Depends(get_page_params)]


class Page[T](BaseModel):
    """Envelope returned by every list endpoint."""

    items: list[T] = Field(default_factory=list)
    total: int = Field(description="Rows matching the filter, ignoring paging.")
    limit: int
    offset: int

    @classmethod
    def of(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        return cls(items=items, total=total, limit=params.limit, offset=params.offset)
