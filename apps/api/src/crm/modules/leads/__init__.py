"""Leads module."""

from crm.modules.leads.models import Lead
from crm.modules.leads.router import router

__all__ = ["Lead", "router"]
