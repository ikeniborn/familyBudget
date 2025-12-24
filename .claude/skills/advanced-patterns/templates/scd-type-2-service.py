"""
SCD Type 2 Service Template
Handles versioning for dimension tables with history tracking
"""

from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, UTC
from typing import Optional

class SCD2Service:
    """Service for SCD Type 2 pattern"""
    
    @staticmethod
    async def create_history_record(
        session: AsyncSession,
        main_record,
        history_model,
        change_type: str = "CREATE"
    ):
        """
        Create history record for dimension change
        
        CRITICAL: Copy ALL fields from main record to history
        Missing fields = IntegrityError
        """
        history = history_model(
            # Link to main record
            **{f"{main_record.__tablename__}_id": main_record.id},
            
            # Copy ALL fields (use dict unpacking)
            **{k: v for k, v in main_record.__dict__.items() 
               if not k.startswith('_')},
            
            # Version control
            valid_from=datetime.now(UTC),
            valid_to=None,
            is_current=True,
            change_type=change_type  # CREATE/UPDATE/DELETE
        )
        session.add(history)
        return history
