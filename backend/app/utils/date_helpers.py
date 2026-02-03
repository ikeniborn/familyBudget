"""
Утилитные функции для работы с датами и периодами в аналитике.

Этот модуль предоставляет функции для:
- Расчета ISO номеров недель
- Получения границ календарных недель
- Генерации rolling периодов (недели, месяцы)
- Пропорционального расчета бюджетов
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal


def get_iso_week_number(target_date: date) -> str:
    """
    Получить ISO номер недели в формате "Н<week> <year>".

    Args:
        target_date: Дата для которой нужен номер недели

    Returns:
        Строка формата "Н54 25" (неделя 54, 2025 год)

    Examples:
        >>> get_iso_week_number(date(2025, 11, 8))
        'Н45 25'
    """
    iso_year, iso_week, iso_weekday = target_date.isocalendar()
    # Формат: Н<номер_недели> <последние_2_цифры_года>
    short_year = str(iso_year)[-2:]
    return f"Н{iso_week} {short_year}"


def get_week_bounds(target_date: date) -> tuple[date, date]:
    """
    Получить границы календарной недели (понедельник-воскресенье).

    Args:
        target_date: Дата внутри недели

    Returns:
        Tuple (monday, sunday) - начало и конец недели

    Examples:
        >>> get_week_bounds(date(2025, 11, 8))  # Пятница
        (date(2025, 11, 3), date(2025, 11, 9))  # Пн-Вс
    """
    # ISO calendar: понедельник = 1, воскресенье = 7
    weekday = target_date.weekday()  # 0=Пн, 6=Вс

    # Начало недели (понедельник)
    monday = target_date - timedelta(days=weekday)

    # Конец недели (воскресенье)
    sunday = monday + timedelta(days=6)

    return monday, sunday


def get_rolling_weeks(
    num_weeks: int,
    end_date: date,
    include_incomplete: bool = True
) -> list[tuple[date, date, str]]:
    """
    Получить последние N календарных недель (rolling period).

    Args:
        num_weeks: Количество недель
        end_date: Конечная дата периода (обычно today)
        include_incomplete: Включать ли неполную текущую неделю

    Returns:
        List[Tuple[week_start, week_end, iso_week_label]]
        Неделя всегда начинается с понедельника

    Examples:
        >>> get_rolling_weeks(4, date(2025, 11, 8))
        [
            (date(2025, 10, 13), date(2025, 10, 19), 'Н42 25'),
            (date(2025, 10, 20), date(2025, 10, 26), 'Н43 25'),
            (date(2025, 10, 27), date(2025, 11, 2), 'Н44 25'),
            (date(2025, 11, 3), date(2025, 11, 8), 'Н45 25')  # Неполная
        ]
    """
    weeks = []

    # Если include_incomplete=True, текущая неделя обрезается до end_date
    if include_incomplete:
        # Текущая неделя: от понедельника до end_date
        current_monday, _ = get_week_bounds(end_date)
        current_week_start = current_monday
        current_week_end = end_date
        iso_label = get_iso_week_number(end_date)
        weeks.append((current_week_start, current_week_end, iso_label))

        # Остальные недели полные
        for i in range(1, num_weeks):
            week_end = current_monday - timedelta(days=1)  # Воскресенье предыдущей недели
            week_start, _ = get_week_bounds(week_end)
            iso_label = get_iso_week_number(week_end)
            weeks.insert(0, (week_start, week_end, iso_label))
            current_monday = week_start
    else:
        # Все недели полные, начиная с ближайшего понедельника назад
        current_date = end_date
        for i in range(num_weeks):
            week_start, week_end = get_week_bounds(current_date)
            iso_label = get_iso_week_number(week_start)
            weeks.insert(0, (week_start, week_end, iso_label))
            current_date = week_start - timedelta(days=1)  # Переход к предыдущей неделе

    return weeks


def get_rolling_months(
    num_months: int,
    end_date: date,
    include_incomplete: bool = True
) -> list[tuple[date, date, str]]:
    """
    Получить последние N календарных месяцев (rolling period).

    Args:
        num_months: Количество месяцев
        end_date: Конечная дата периода (обычно today)
        include_incomplete: Включать ли неполный текущий месяц

    Returns:
        List[Tuple[month_start, month_end, month_label]]
        Месяц всегда начинается с 1 числа

    Examples:
        >>> get_rolling_months(3, date(2025, 11, 8))
        [
            (date(2025, 9, 1), date(2025, 9, 30), 'Сен 2025'),
            (date(2025, 10, 1), date(2025, 10, 31), 'Окт 2025'),
            (date(2025, 11, 1), date(2025, 11, 8), 'Ноя 2025')  # Неполный
        ]
    """
    month_names_ru = [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
        "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
    ]

    months = []
    current_year = end_date.year
    current_month = end_date.month

    for i in range(num_months):
        # Первый день месяца
        month_start = date(current_year, current_month, 1)

        # Последний день месяца
        _, last_day = calendar.monthrange(current_year, current_month)
        month_end = date(current_year, current_month, last_day)

        # Если это текущий месяц и include_incomplete=True, обрезаем до end_date
        if i == 0 and include_incomplete and end_date < month_end:
            month_end = end_date

        # Label формата "Ноя 2025"
        month_label = f"{month_names_ru[current_month - 1]} {current_year}"

        months.insert(0, (month_start, month_end, month_label))

        # Переход к предыдущему месяцу
        current_month -= 1
        if current_month == 0:
            current_month = 12
            current_year -= 1

    return months


def get_proportional_budget(
    monthly_budget: Decimal,
    days_in_period: int,
    days_in_month: int = 30
) -> Decimal:
    """
    Рассчитать пропорциональный бюджет для периода.

    Args:
        monthly_budget: Месячный бюджет
        days_in_period: Количество дней в периоде (например, 7 для недели)
        days_in_month: Количество дней в месяце (по умолчанию 30)

    Returns:
        Пропорциональный бюджет

    Examples:
        >>> get_proportional_budget(Decimal("30000"), 7, 30)
        Decimal('7000.00')  # 30000 / 30 * 7
    """
    if days_in_month <= 0:
        raise ValueError("days_in_month must be positive")

    # Бюджет на 1 день
    daily_budget = monthly_budget / Decimal(days_in_month)

    # Бюджет на период
    period_budget = daily_budget * Decimal(days_in_period)

    return period_budget.quantize(Decimal("0.01"))


def get_month_name_short_ru(month: int) -> str:
    """
    Получить короткое название месяца на русском.

    Args:
        month: Номер месяца (1-12)

    Returns:
        Короткое название (3 буквы)

    Examples:
        >>> get_month_name_short_ru(11)
        'Ноя'
    """
    month_names = [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
        "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
    ]

    if not 1 <= month <= 12:
        raise ValueError(f"Invalid month: {month}. Must be 1-12")

    return month_names[month - 1]


def get_quarter_bounds(target_date: date) -> tuple[date, date, str]:
    """
    Получить границы rolling квартала (3 месяца от текущего месяца).

    Rolling квартал = текущий месяц + 2 месяца назад.

    Args:
        target_date: Дата для которой нужен квартал

    Returns:
        Tuple[quarter_start, quarter_end, quarter_label]

    Examples:
        >>> get_quarter_bounds(date(2025, 11, 8))
        (date(2025, 9, 1), date(2025, 11, 8), 'Сен — Ноя 2025')
    """
    # Получить последние 3 месяца
    months = get_rolling_months(3, target_date, include_incomplete=True)

    # Начало квартала = начало первого месяца
    quarter_start = months[0][0]

    # Конец квартала = конец последнего месяца (обрезанный до target_date)
    quarter_end = months[-1][1]

    # Label формата "Сен — Ноя 2025"
    start_month_name = get_month_name_short_ru(quarter_start.month)
    end_month_name = get_month_name_short_ru(quarter_end.month)
    year = quarter_end.year

    quarter_label = f"{start_month_name} — {end_month_name} {year}"

    return quarter_start, quarter_end, quarter_label


# ============================================================================
# Calendar-Based Period Functions (для предустановленных фильтров)
# ============================================================================


def get_current_calendar_month(target_date: date) -> tuple[date, date]:
    """
    Получить границы текущего календарного месяца.

    Возвращает период от 1 числа месяца до последнего дня месяца
    (или до target_date, если месяц еще не завершен).

    Args:
        target_date: Дата внутри месяца (обычно today)

    Returns:
        Tuple[month_start, month_end_or_today]
        - month_start: 1 число текущего месяца
        - month_end_or_today: min(последний день месяца, target_date)

    Examples:
        >>> get_current_calendar_month(date(2025, 11, 8))
        (date(2025, 11, 1), date(2025, 11, 8))  # Неполный месяц

        >>> get_current_calendar_month(date(2025, 11, 30))
        (date(2025, 11, 1), date(2025, 11, 30))  # Полный месяц
    """
    # Первый день месяца
    month_start = date(target_date.year, target_date.month, 1)

    # Последний день месяца
    _, last_day = calendar.monthrange(target_date.year, target_date.month)
    month_end = date(target_date.year, target_date.month, last_day)

    # Если target_date раньше конца месяца, обрезаем до target_date
    return month_start, min(month_end, target_date)


def get_current_calendar_quarter(target_date: date) -> tuple[date, date]:
    """
    Получить границы текущего календарного квартала.

    Календарный квартал:
    - Q1: Январь-Март (месяцы 1-3)
    - Q2: Апрель-Июнь (месяцы 4-6)
    - Q3: Июль-Сентябрь (месяцы 7-9)
    - Q4: Октябрь-Декабрь (месяцы 10-12)

    Args:
        target_date: Дата внутри квартала (обычно today)

    Returns:
        Tuple[quarter_start, quarter_end_or_today]
        - quarter_start: 1 число первого месяца квартала
        - quarter_end_or_today: min(последний день квартала, target_date)

    Examples:
        >>> get_current_calendar_quarter(date(2025, 11, 8))
        (date(2025, 10, 1), date(2025, 11, 8))  # Q4 неполный

        >>> get_current_calendar_quarter(date(2025, 3, 31))
        (date(2025, 1, 1), date(2025, 3, 31))  # Q1 полный
    """
    # Определить номер квартала (Q1=1, Q2=2, Q3=3, Q4=4)
    quarter_num = (target_date.month - 1) // 3 + 1

    # Первый месяц квартала (Q1→1, Q2→4, Q3→7, Q4→10)
    first_month = (quarter_num - 1) * 3 + 1
    quarter_start = date(target_date.year, first_month, 1)

    # Последний месяц квартала (Q1→3, Q2→6, Q3→9, Q4→12)
    last_month = first_month + 2
    _, last_day = calendar.monthrange(target_date.year, last_month)
    quarter_end = date(target_date.year, last_month, last_day)

    # Если target_date раньше конца квартала, обрезаем до target_date
    return quarter_start, min(quarter_end, target_date)


def get_current_calendar_year(target_date: date) -> tuple[date, date]:
    """
    Получить границы текущего календарного года.

    Возвращает период от 1 января до 31 декабря
    (или до target_date, если год еще не завершен).

    Args:
        target_date: Дата внутри года (обычно today)

    Returns:
        Tuple[year_start, year_end_or_today]
        - year_start: 1 января текущего года
        - year_end_or_today: min(31 декабря, target_date)

    Examples:
        >>> get_current_calendar_year(date(2025, 11, 8))
        (date(2025, 1, 1), date(2025, 11, 8))  # Неполный год

        >>> get_current_calendar_year(date(2025, 12, 31))
        (date(2025, 1, 1), date(2025, 12, 31))  # Полный год
    """
    # Первый день года
    year_start = date(target_date.year, 1, 1)

    # Последний день года
    year_end = date(target_date.year, 12, 31)

    # Если target_date раньше конца года, обрезаем до target_date
    return year_start, min(year_end, target_date)
