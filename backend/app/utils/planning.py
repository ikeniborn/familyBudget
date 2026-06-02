from datetime import date, timedelta


def get_planning_month(as_of: date | None = None) -> date:
    today = as_of or date.today()
    if today.day >= 20:
        return (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    return today.replace(day=1)
