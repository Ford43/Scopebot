"""Versioned knowledge publication, preserving legacy indexes."""
from alembic import op
import sqlalchemy as sa

revision = "004_knowledge_generations"
down_revision = "003_audit_logs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bots", sa.Column("active_index_path", sa.Text(), nullable=True))
    op.add_column("bots", sa.Column("knowledge_revision", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("bots", sa.Column("indexed_revision", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("bots", sa.Column("knowledge_blocked", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("bots", sa.Column("knowledge_update_status", sa.String(20), nullable=False, server_default="idle"))
    op.add_column("bots", sa.Column("knowledge_update_error", sa.Text(), nullable=True))
    op.add_column("bots", sa.Column("knowledge_update_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    for column in ("knowledge_update_started_at", "knowledge_update_error", "knowledge_update_status",
                   "knowledge_blocked", "indexed_revision", "knowledge_revision", "active_index_path"):
        op.drop_column("bots", column)
