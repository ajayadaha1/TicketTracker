from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint, func

from .database import Base


class AssigneeUser(Base):
    """Available users for Jira ticket assignment."""
    __tablename__ = "assignee_users"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ActivityLog(Base):
    """Audit trail for ticket actions."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String, nullable=False, index=True)
    user_email = Column(String, nullable=False)
    ticket_key = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    label = Column(String, nullable=True, default="")
    comment = Column(Text, nullable=True, default="")
    details = Column(Text, nullable=True, default="")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )


class Session(Base):
    """Persistent OAuth session store."""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    cloud_id = Column(String, nullable=False)
    expires_at = Column(Float, nullable=False)
    created_at = Column(Float, nullable=False)
    user_info = Column(Text, nullable=False, default="{}")  # JSON string


class DropdownOption(Base):
    """Configurable dropdown options for Stage, Flow, and Result fields."""
    __tablename__ = "dropdown_options"
    __table_args__ = (
        UniqueConstraint("category", "parent_stage", "value", name="uq_dropdown_option"),
    )

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, index=True)  # "stage", "flow", "result"
    parent_stage = Column(String, nullable=True, default="")  # Only for flows: which stage this flow belongs to
    value = Column(String, nullable=False)
    label = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
