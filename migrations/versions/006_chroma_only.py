"""Use ChromaDB only; preserve source files and all existing index directories."""
from alembic import op
import sqlalchemy as sa

revision = "006_chroma_only"
down_revision = "005_vector_backend"
branch_labels = None
depends_on = None


def upgrade():
    # Never relabel a Qdrant index as a usable Chroma generation. Incrementing
    # the revision also invalidates results from any in-flight old worker.
    bots = sa.table('bots',
        sa.column('vector_backend', sa.String), sa.column('status', sa.String),
        sa.column('active_index_path', sa.Text), sa.column('knowledge_revision', sa.Integer),
        sa.column('knowledge_blocked', sa.Boolean), sa.column('knowledge_update_status', sa.String),
        sa.column('knowledge_update_error', sa.Text), sa.column('knowledge_update_started_at', sa.DateTime))
    op.execute(bots.update().where(bots.c.vector_backend == 'qdrant').values(
        vector_backend='chroma', status='inactive', active_index_path=None,
        knowledge_revision=bots.c.knowledge_revision + 1, knowledge_blocked=True,
        knowledge_update_status='error', knowledge_update_started_at=None,
        knowledge_update_error='กรุณาประมวลผลเอกสารใหม่เพื่อสร้างฐานความรู้ ChromaDB'))
    with op.batch_alter_table('bots') as batch:
        batch.create_check_constraint('ck_bots_chroma_only', "vector_backend = 'chroma'")


def downgrade():
    with op.batch_alter_table('bots') as batch:
        batch.drop_constraint('ck_bots_chroma_only', type_='check')
    # Restoring multi-backend code must not make a converted index usable as
    # Qdrant. Chroma data and the blocked/rebuild state intentionally remain.
