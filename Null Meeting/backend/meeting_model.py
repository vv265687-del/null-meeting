from sqlalchemy import Column, Integer, String, DateTime

from datetime import datetime

from database import Base


# =========================================================
# MEETING MODEL
# =========================================================

class Meeting(Base):

    __tablename__ = "meetings"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    meeting_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    host_id = Column(
        Integer,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )