
from sqlalchemy import create_engine, text
import json

# Database connection
db_path = 'metadata.db'
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as connection:
    # 1. Tables
    # Orphaned Tables: Not linked to any datasource
    orphaned_tables = connection.execute(text("""
        SELECT COUNT(*) FROM tables t
        LEFT JOIN table_to_datasource td ON t.id = td.table_id
        WHERE td.datasource_id IS NULL
    """)).scalar()
    total_tables = connection.execute(text("SELECT COUNT(*) FROM tables")).scalar()
    connected_tables = total_tables - orphaned_tables

    # 2. Datasources
    # Orphaned Datasources: Not linked to any workbook
    orphaned_datasources = connection.execute(text("""
        SELECT COUNT(*) FROM datasources d
        LEFT JOIN datasource_to_workbook dw ON d.id = dw.datasource_id
        WHERE dw.workbook_id IS NULL AND (d.is_embedded = 0 OR d.is_embedded IS NULL)
    """)).scalar()
    
    # Embedded are inherently "connected" to their workbook usually, but let's check
    # Actually embedded datasources exist WITHIN a workbook, so they shouldn't be orphaned in that sense,
    # but let's count Published Datasources that are unused.
    
    total_datasources = connection.execute(text("SELECT COUNT(*) FROM datasources")).scalar()
    embedded_ds = connection.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 1")).scalar()
    non_embedded_ds = connection.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL")).scalar()
    
    # Connected Non-Embedded
    connected_non_embedded = non_embedded_ds - orphaned_datasources

    # 3. Fields
    # Orphaned Fields: Not used in any view (field_to_view) AND Is Calculated (optional check, but usually we care about usage)
    # User asked for "Data Lineage", usually implied "Used in downstream".
    # Let's count "Unused Fields" as orphaned.
    
    orphaned_fields = connection.execute(text("""
        SELECT COUNT(*) FROM fields f
        WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id)
    """)).scalar()
    total_fields = connection.execute(text("SELECT COUNT(*) FROM fields")).scalar()
    connected_fields = total_fields - orphaned_fields

    # 4. Workbooks
    # Orphaned Workbooks: No views? Or just count total.
    # Usually workbooks are the end of the line, unless we check for "Empty Workbooks"
    empty_workbooks = connection.execute(text("""
        SELECT COUNT(*) FROM workbooks w
        WHERE NOT EXISTS (SELECT 1 FROM views v WHERE v.workbook_id = w.id)
    """)).scalar()
    total_workbooks = connection.execute(text("SELECT COUNT(*) FROM workbooks")).scalar()
    
    results = {
        "Tables": {
            "Total": total_tables,
            "Connected": connected_tables,
            "Orphaned": orphaned_tables
        },
        "Datasources": {
            "Total": total_datasources,
            "Embedded": embedded_ds,
            "NonEmbedded": {
                "Total": non_embedded_ds,
                "Connected": connected_non_embedded,
                "Orphaned": orphaned_datasources
            }
        },
        "Fields": {
            "Total": total_fields,
            "Connected": connected_fields,
            "Orphaned": orphaned_fields
        },
        "Workbooks": {
            "Total": total_workbooks,
            "Empty": empty_workbooks,
            "Active": total_workbooks - empty_workbooks
        }
    }
    
    print(json.dumps(results, indent=2))
