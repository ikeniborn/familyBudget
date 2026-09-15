"""Unit tests for Phase 1 medicine models (no DB)."""
from datetime import date, datetime
from decimal import Decimal

from backend.app.models.medicine import Medicine
from backend.app.models.medicine_history import MedicineHistory
from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine_stock import MedicineStock


def test_medicine_fields():
    m = Medicine(name="Нурофен 200мг", form="tablet", creator_id=1)
    assert m.name == "Нурофен 200мг"
    assert m.form == "tablet"
    assert m.is_active is True          # default active
    assert m.prescription_required is False
    assert m.inn is None
    assert m.__tablename__ == "t_d_medicine"


def test_medicine_history_fields():
    h = MedicineHistory(
        medicine_id=1, creator_id=1, name="Нурофен 200мг", form="tablet",
        prescription_required=False, is_active=True,
        valid_from=datetime(2026, 6, 15), is_current=True, change_type="CREATE",
    )
    assert h.medicine_id == 1
    assert h.change_type == "CREATE"
    assert h.is_current is True
    assert h.__tablename__ == "t_d_medicine_history"


def test_family_member_fields():
    fm = FamilyMember(name="Маша", guardian_user_id=1)
    assert fm.name == "Маша"
    assert fm.guardian_user_id == 1
    assert fm.linked_user_id is None
    assert fm.is_active is True          # default active (soft-archive flag)
    assert fm.__tablename__ == "t_d_family_member"


def test_medicine_stock_fields():
    s = MedicineStock(
        medicine_id=1, quantity_remaining=Decimal("20"),
        quantity_initial=Decimal("20"), unit="шт",
        expiry_date=date(2027, 1, 1), creator_id=1,
    )
    assert s.quantity_remaining == Decimal("20")
    assert s.unit == "шт"
    assert s.version == 1                # optimistic lock default
    assert s.deleted_at is None
    assert s.__tablename__ == "t_f_medicine_stock"
