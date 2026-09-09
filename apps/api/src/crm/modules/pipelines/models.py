"""Pipeline and PipelineStage database models."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Pipeline(TenantModel):
    """Pipeline model organizing opportunity stages."""

    __tablename__ = "pipelines"
    __table_args__ = (
        Index("ix_pipelines_tenant_id_is_default", "tenant_id", "is_default"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    stages: Mapped[list["PipelineStage"]] = relationship(
        "PipelineStage",
        back_populates="pipeline",
        order_by="PipelineStage.display_order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PipelineStage(TenantModel):
    """Stage within a sales pipeline."""

    __tablename__ = "pipeline_stages"
    __table_args__ = (
        Index("ix_pipeline_stages_pipeline_id_order", "pipeline_id", "display_order"),
    )

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    probability: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    pipeline: Mapped["Pipeline"] = relationship("Pipeline", back_populates="stages")
