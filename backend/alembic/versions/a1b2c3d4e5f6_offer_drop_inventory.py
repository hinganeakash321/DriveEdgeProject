"""add quotation special_offer; drop dealer_inventory

Revision ID: a1b2c3d4e5f6
Revises: d499af661f75
Create Date: 2026-10-24 21:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d499af661f75"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("special_offer", sa.Text(), nullable=True))
    op.drop_index(op.f("ix_dealer_inventory_vehicle_variant_id"), table_name="dealer_inventory")
    op.drop_index(op.f("ix_dealer_inventory_dealer_id"), table_name="dealer_inventory")
    op.drop_table("dealer_inventory")


def downgrade() -> None:
    op.create_table(
        "dealer_inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dealer_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_variant_id", sa.Integer(), nullable=False),
        sa.Column("availability_status", sa.String(length=30), nullable=False),
        sa.Column("dealer_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["dealer_id"], ["dealers.id"]),
        sa.ForeignKeyConstraint(["vehicle_variant_id"], ["vehicle_variants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_dealer_inventory_dealer_id"), "dealer_inventory", ["dealer_id"], unique=False)
    op.create_index(
        op.f("ix_dealer_inventory_vehicle_variant_id"), "dealer_inventory", ["vehicle_variant_id"], unique=False
    )
    op.drop_column("quotations", "special_offer")
