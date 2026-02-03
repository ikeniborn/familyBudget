"""
Export utilities for CSV generation.

Provides functions to export data in CSV format for download.
"""

import csv
import io
from datetime import datetime
from typing import Any

from fastapi.responses import StreamingResponse

# ============================================================================
# CSV Export
# ============================================================================


def export_to_csv(
    data: list[dict[str, Any]],
    filename: str,
    columns: list[str] = None
) -> StreamingResponse:
    """
    Export data to CSV format.

    Args:
        data: List of dictionaries containing the data
        filename: Name of the file to download
        columns: List of column names to include (None = all columns)

    Returns:
        StreamingResponse with CSV data
    """
    if not data:
        # Return empty CSV with headers only
        output = io.StringIO()
        if columns:
            writer = csv.DictWriter(output, fieldnames=columns)
            writer.writeheader()

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    # Determine columns
    if not columns:
        columns = list(data[0].keys())

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()

    for row in data:
        # Filter to include only specified columns
        filtered_row = {k: v for k, v in row.items() if k in columns}
        writer.writerow(filtered_row)

    # Return as streaming response
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ============================================================================
# Helper Functions
# ============================================================================


def generate_filename(prefix: str, extension: str, include_timestamp: bool = True) -> str:
    """
    Generate a filename for export.

    Args:
        prefix: Filename prefix (e.g., "transactions", "users")
        extension: File extension without dot (e.g., "csv", "xlsx", "pdf")
        include_timestamp: Whether to include timestamp in filename

    Returns:
        Formatted filename
    """
    if include_timestamp:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}.{extension}"
    else:
        return f"{prefix}.{extension}"
