"""initial schema matching api.models

Revision ID: 001_initial
Revises:
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

userrole = sa.Enum("user", "support", "admin", name="userrole")
botstatus = sa.Enum("active", "inactive", "processing", name="botstatus")
sessionmode = sa.Enum("bot", "waiting", "human", name="sessionmode")
sendertype = sa.Enum("customer", "bot", "staff", name="sendertype")


def upgrade() -> None:
    userrole.create(op.get_bind(), checkfirst=True)
    botstatus.create(op.get_bind(), checkfirst=True)
    sessionmode.create(op.get_bind(), checkfirst=True)
    sendertype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", userrole, nullable=True),
        sa.Column("is_approved", sa.Boolean(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("max_bots", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "bots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bot_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", botstatus, nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("is_line_connected", sa.Boolean(), nullable=True),
        sa.Column("is_web_connected", sa.Boolean(), nullable=True),
        sa.Column("line_channel_token", sa.String(), nullable=True),
        sa.Column("line_channel_secret", sa.String(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bots_bot_id"), "bots", ["bot_id"], unique=True)
    op.create_index(op.f("ix_bots_id"), "bots", ["id"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)

    op.create_table(
        "bot_documents",
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("bot_id", "document_id"),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("is_answered_by_bot", sa.Boolean(), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), nullable=True),
        sa.Column("source_channel", sa.String(), nullable=True),
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversations_id"), "conversations", ["id"], unique=False)
    op.create_index(op.f("ix_conversations_session_id"), "conversations", ["session_id"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)

    op.create_table(
        "live_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("line_user_id", sa.String(), nullable=False),
        sa.Column("line_display_name", sa.String(), nullable=True),
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("mode", sessionmode, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_live_sessions_id"), "live_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_live_sessions_line_user_id"), "live_sessions", ["line_user_id"], unique=False)

    op.create_table(
        "live_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("sender_type", sendertype, nullable=False),
        sa.Column("sender_name", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_live_messages_id"), "live_messages", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_live_messages_id"), table_name="live_messages")
    op.drop_table("live_messages")
    op.drop_index(op.f("ix_live_sessions_line_user_id"), table_name="live_sessions")
    op.drop_index(op.f("ix_live_sessions_id"), table_name="live_sessions")
    op.drop_table("live_sessions")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_conversations_session_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_id"), table_name="conversations")
    op.drop_table("conversations")
    op.drop_table("bot_documents")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_index(op.f("ix_bots_id"), table_name="bots")
    op.drop_index(op.f("ix_bots_bot_id"), table_name="bots")
    op.drop_table("bots")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    sendertype.drop(op.get_bind(), checkfirst=True)
    sessionmode.drop(op.get_bind(), checkfirst=True)
    botstatus.drop(op.get_bind(), checkfirst=True)
    userrole.drop(op.get_bind(), checkfirst=True)
