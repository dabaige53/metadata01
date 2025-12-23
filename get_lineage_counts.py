
from sqlalchemy import create_engine, text
import json

# Database connection
db_path = 'metadata.db'
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as connection:
    # 1. Database Layer
    db_count = connection.execute(text("SELECT COUNT(*) FROM databases")).scalar()
    table_count = connection.execute(text("SELECT COUNT(*) FROM tables")).scalar()
    column_count = connection.execute(text("SELECT COUNT(*) FROM db_columns")).scalar()

    # 2. Data Processing Layer
    total_datasources = connection.execute(text("SELECT COUNT(*) FROM datasources")).scalar()
    embedded_ds = connection.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 1")).scalar()
    non_embedded_ds = connection.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL")).scalar()

    # Fields vs Metrics
    # Count fields that are NOT metrics (assuming non-calculated or dimensions?)
    # The user image shows Field -> Metric
    # Based on api.py: metrics are calculated fields with role measure.
    # Let's count totals from 'fields'
    total_fields = connection.execute(text("SELECT COUNT(*) FROM fields")).scalar()
    
    # Try to count from 'metrics' table if it has data
    metrics_table_count = connection.execute(text("SELECT COUNT(*) FROM metrics")).scalar()
    
    # Count calculated fields (as proxy if metrics table is empty)
    calc_fields_count = connection.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 1")).scalar()
    native_fields_count = connection.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL")).scalar()

    # 3. Presentation Layer
    workbook_count = connection.execute(text("SELECT COUNT(*) FROM workbooks")).scalar()
    view_count = connection.execute(text("SELECT COUNT(*) FROM views")).scalar()

    results = {
        "Database Layer": {
            "Databases": db_count,
            "Tables": table_count,
            "Columns": column_count
        },
        "Processing Layer": {
            "Datasources": {
                "Total": total_datasources,
                "Embedded": embedded_ds,
                "Non-Embedded": non_embedded_ds
            },
            "Fields": {
                "Total": total_fields,
                "Native": native_fields_count,
                "Calculated": calc_fields_count
            },
            "Metrics": metrics_table_count
        },
        "Presentation Layer": {
            "Workbooks": workbook_count,
            "Views": view_count
        }
    }
    
    print(json.dumps(results, indent=2))
