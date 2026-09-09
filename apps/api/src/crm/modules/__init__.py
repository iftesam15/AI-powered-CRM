"""CRM domain modules.

Importing every model here gives Alembic's autogenerate and the test suite's
`create_all` one place that knows the full schema. A model missing from this
list is a table that silently never appears in a generated migration.
"""

from crm.modules.accounts.models import Account
from crm.modules.activities.models import Activity
from crm.modules.audit.models import AuditLog
from crm.modules.auth.models import PasswordResetToken, RefreshToken
from crm.modules.contacts.models import Contact
from crm.modules.leads.models import Lead
from crm.modules.opportunities.models import Opportunity, OpportunityStageHistory
from crm.modules.pipelines.models import Pipeline, PipelineStage
from crm.modules.tasks.models import Task
from crm.modules.tenants.models import Tenant
from crm.modules.users.models import User

__all__ = [
    "Account",
    "Activity",
    "AuditLog",
    "Contact",
    "Lead",
    "Opportunity",
    "OpportunityStageHistory",
    "PasswordResetToken",
    "Pipeline",
    "PipelineStage",
    "RefreshToken",
    "Task",
    "Tenant",
    "User",
]

