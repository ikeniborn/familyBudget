#!/usr/bin/env python3
"""
Seed script for global reference data (справочники).

This script populates the database with default global reference records:
- Global Articles (income/expense categories)
- Global Financial Centers (ЦФО - bank types, cash, etc.)
- Global Cost Centers (МВЗ - project types, departments, etc.)

Usage:
    python backend/db/seed_global_references.py

Features:
    - Idempotent: can be run multiple times without creating duplicates
    - Async SQLAlchemy for performance
    - Uses actual models (not raw SQL)
    - Logs all operations
    - Creates a default admin user if not exists

Requirements:
    - Database must be initialized (migrations applied)
    - Connection settings from environment (.env file)
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

from app.core.config import get_settings
from app.models.article import Article
from app.models.cost_center import CostCenter
from app.models.financial_center import FinancialCenter
from app.models.user import User

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Default admin user (for creating global records)
DEFAULT_ADMIN = {
    "telegram_id": 1000000001,  # Placeholder Telegram ID
    "username": "admin",
    "first_name": "System",
    "last_name": "Administrator",
    "is_admin": True,
}

# Global Articles (Categories)
GLOBAL_ARTICLES = [
    # Income categories
    {"name": "Доходы", "type": "income", "parent_id": None, "description": "Все виды доходов"},
    {"name": "Зарплата", "type": "income", "parent": "Доходы", "description": "Заработная плата"},
    {"name": "Премия", "type": "income", "parent": "Доходы", "description": "Премии и бонусы"},
    {"name": "Подработка", "type": "income", "parent": "Доходы", "description": "Дополнительный заработок"},
    {"name": "Возврат долга", "type": "income", "parent": "Доходы", "description": "Возврат займов"},
    
    # Expense categories
    {"name": "Расходы", "type": "expense", "parent_id": None, "description": "Все виды расходов"},
    {"name": "Продукты", "type": "expense", "parent": "Расходы", "description": "Покупка продуктов питания"},
    {"name": "Транспорт", "type": "expense", "parent": "Расходы", "description": "Транспортные расходы"},
    {"name": "Коммунальные услуги", "type": "expense", "parent": "Расходы", "description": "ЖКХ, интернет, связь"},
    {"name": "Развлечения", "type": "expense", "parent": "Расходы", "description": "Отдых и развлечения"},
    {"name": "Здоровье", "type": "expense", "parent": "Расходы", "description": "Медицина и здоровье"},
    {"name": "Образование", "type": "expense", "parent": "Расходы", "description": "Обучение, курсы"},
    {"name": "Одежда", "type": "expense", "parent": "Расходы", "description": "Одежда и обувь"},
    {"name": "Кафе и рестораны", "type": "expense", "parent": "Расходы", "description": "Общественное питание"},
    {"name": "Подарки", "type": "expense", "parent": "Расходы", "description": "Подарки и поздравления"},
    {"name": "Прочее", "type": "expense", "parent": "Расходы", "description": "Другие расходы"},
]

# Global Financial Centers (ЦФО)
GLOBAL_FINANCIAL_CENTERS = [
    {"name": "Наличные", "description": "Наличные деньги"},
    {"name": "Банковская карта", "description": "Дебетовая/кредитная карта"},
    {"name": "Сбербанк", "description": "Счет в Сбербанке"},
    {"name": "Тинькофф", "description": "Счет в Тинькофф Банке"},
    {"name": "Альфа-Банк", "description": "Счет в Альфа-Банке"},
    {"name": "Электронный кошелек", "description": "Яндекс.Деньги, Qiwi, и т.д."},
]

# Global Cost Centers (МВЗ)
GLOBAL_COST_CENTERS = [
    {"name": "Общий", "description": "Общие расходы без проекта"},
    {"name": "Семейный бюджет", "description": "Семейные расходы"},
    {"name": "Личные расходы", "description": "Личные покупки"},
    {"name": "Ремонт", "description": "Ремонт и обустройство"},
    {"name": "Отпуск", "description": "Отпуск и путешествия"},
    {"name": "Накопления", "description": "Накопительные цели"},
]


async def get_or_create_admin_user(session: AsyncSession) -> User:
    """Get or create default admin user for creating global records."""
    # Check if admin user exists
    stmt = select(User).where(
        User.telegram_id == DEFAULT_ADMIN["telegram_id"],
        User.is_current == True
    )
    result = await session.execute(stmt)
    admin_user = result.scalar_one_or_none()
    
    if admin_user:
        logger.info(f"Admin user found: {admin_user.username} (id={admin_user.id})")
        return admin_user
    
    # Create admin user
    now = datetime.utcnow()
    admin_user = User(
        telegram_id=DEFAULT_ADMIN["telegram_id"],
        username=DEFAULT_ADMIN["username"],
        first_name=DEFAULT_ADMIN["first_name"],
        last_name=DEFAULT_ADMIN["last_name"],
        is_admin=DEFAULT_ADMIN["is_admin"],
        is_current=True,
        valid_from=now,
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        created_at=now,
        updated_at=now,
    )
    
    session.add(admin_user)
    await session.flush()
    await session.refresh(admin_user)
    
    logger.info(f"Admin user created: {admin_user.username} (id={admin_user.id})")
    return admin_user


async def seed_global_articles(session: AsyncSession, admin_user: User):
    """Seed global articles (categories) with hierarchy."""
    logger.info("Seeding global articles...")
    
    # Track created articles by name for parent_id resolution
    article_map = {}
    created_count = 0
    skipped_count = 0
    
    for article_data in GLOBAL_ARTICLES:
        name = article_data["name"]
        article_type = article_data["type"]
        
        # Check if article already exists (by name + type + is_global)
        stmt = select(Article).where(
            Article.name == name,
            Article.type == article_type,
            Article.is_global == True,
            Article.is_current == True
        )
        result = await session.execute(stmt)
        existing_article = result.scalar_one_or_none()
        
        if existing_article:
            logger.debug(f"Article already exists: {name} ({article_type})")
            article_map[name] = existing_article
            skipped_count += 1
            continue
        
        # Resolve parent_id
        parent_id = article_data.get("parent_id")
        parent_name = article_data.get("parent")
        if parent_name and parent_name in article_map:
            parent_id = article_map[parent_name].id
        
        # Create article
        now = datetime.utcnow()
        article = Article(
            user_id=admin_user.id,
            parent_id=parent_id,
            name=name,
            type=article_type,
            is_global=True,
            is_current=True,
            valid_from=now,
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
            created_at=now,
            updated_at=now,
        )
        
        session.add(article)
        await session.flush()
        await session.refresh(article)
        
        article_map[name] = article
        created_count += 1
        logger.debug(f"Created article: {name} ({article_type}, id={article.id})")
    
    logger.info(f"Articles: created={created_count}, skipped={skipped_count}")


async def seed_global_financial_centers(session: AsyncSession, admin_user: User):
    """Seed global financial centers (ЦФО)."""
    logger.info("Seeding global financial centers...")
    
    created_count = 0
    skipped_count = 0
    
    for fc_data in GLOBAL_FINANCIAL_CENTERS:
        name = fc_data["name"]
        
        # Check if financial center already exists
        stmt = select(FinancialCenter).where(
            FinancialCenter.name == name,
            FinancialCenter.is_global == True,
            FinancialCenter.is_current == True
        )
        result = await session.execute(stmt)
        existing_fc = result.scalar_one_or_none()
        
        if existing_fc:
            logger.debug(f"Financial center already exists: {name}")
            skipped_count += 1
            continue
        
        # Create financial center
        now = datetime.utcnow()
        financial_center = FinancialCenter(
            user_id=admin_user.id,
            name=name,
            description=fc_data.get("description"),
            is_global=True,
            is_current=True,
            valid_from=now,
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
            created_at=now,
            updated_at=now,
        )
        
        session.add(financial_center)
        created_count += 1
        logger.debug(f"Created financial center: {name} (id={financial_center.id})")
    
    await session.flush()
    logger.info(f"Financial centers: created={created_count}, skipped={skipped_count}")


async def seed_global_cost_centers(session: AsyncSession, admin_user: User):
    """Seed global cost centers (МВЗ)."""
    logger.info("Seeding global cost centers...")
    
    created_count = 0
    skipped_count = 0
    
    for cc_data in GLOBAL_COST_CENTERS:
        name = cc_data["name"]
        
        # Check if cost center already exists
        stmt = select(CostCenter).where(
            CostCenter.name == name,
            CostCenter.is_global == True,
            CostCenter.is_current == True
        )
        result = await session.execute(stmt)
        existing_cc = result.scalar_one_or_none()
        
        if existing_cc:
            logger.debug(f"Cost center already exists: {name}")
            skipped_count += 1
            continue
        
        # Create cost center
        now = datetime.utcnow()
        cost_center = CostCenter(
            user_id=admin_user.id,
            name=name,
            description=cc_data.get("description"),
            is_global=True,
            is_current=True,
            valid_from=now,
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
            created_at=now,
            updated_at=now,
        )
        
        session.add(cost_center)
        created_count += 1
        logger.debug(f"Created cost center: {name} (id={cost_center.id})")
    
    await session.flush()
    logger.info(f"Cost centers: created={created_count}, skipped={skipped_count}")


async def main():
    """Main seed function."""
    logger.info("Starting global references seeding...")
    
    # Get database settings
    settings = get_settings()
    database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    
    # Create async session
    async_session_maker = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        try:
            # Step 1: Get or create admin user
            admin_user = await get_or_create_admin_user(session)
            
            # Step 2: Seed global articles
            await seed_global_articles(session, admin_user)
            
            # Step 3: Seed global financial centers
            await seed_global_financial_centers(session, admin_user)
            
            # Step 4: Seed global cost centers
            await seed_global_cost_centers(session, admin_user)
            
            # Commit all changes
            await session.commit()
            logger.info("✓ All global references seeded successfully!")
            
        except Exception as e:
            logger.error(f"✗ Error during seeding: {e}", exc_info=True)
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
