"""Choose a retrieval backend per bot, preserving all existing Chroma bots."""
from alembic import op
import sqlalchemy as sa

revision = "005_vector_backend"
down_revision = "004_knowledge_generations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bots", sa.Column("vector_backend", sa.String(20), nullable=False, server_default="chroma"))


def downgrade():
    op.drop_column("bots", "vector_backend")
