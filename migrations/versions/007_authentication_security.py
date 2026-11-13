"""Persistent authentication throttling and current-token revocation."""
from alembic import op
import sqlalchemy as sa

revision = "007_authentication_security"
down_revision = "006_chroma_only"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('login_throttles',
        sa.Column('key', sa.String(80), primary_key=True),
        sa.Column('failures', sa.Text(), nullable=False),
        sa.Column('blocked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('revoked_tokens',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_revoked_tokens_expires_at', 'revoked_tokens', ['expires_at'])


def downgrade():
    op.drop_table('revoked_tokens')
    op.drop_table('login_throttles')
