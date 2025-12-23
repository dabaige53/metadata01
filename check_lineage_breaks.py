
from sqlalchemy import create_engine, text
import json

# Database connection
db_path = 'metadata.db'
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as connection:
    # 1. Broken Tables (No Database)
    tables_no_db = connection.execute(text("SELECT COUNT(*) FROM tables WHERE database_id IS NULL")).scalar()

    # 2. Broken Datasources (No Tables) - "Schemaless Datasources"
    # Logic: Datasource exists but has no entries in table_to_datasource
    datasources_no_table = connection.execute(text("""
        SELECT COUNT(*) FROM datasources d
        WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = d.id)
    """)).scalar()

    # 3. Broken Workbooks (No Datasources)
    workbooks_no_ds = connection.execute(text("""
        SELECT COUNT(*) FROM workbooks w
        WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.workbook_id = w.id)
    """)).scalar()

    # 4. Fields without Source (No Table AND No Datasource) - likely purely calculated or broken
    fields_no_source = connection.execute(text("""
        SELECT COUNT(*) FROM fields f
        WHERE table_id IS NULL AND datasource_id IS NULL AND workbook_id IS NULL
    """)).scalar()
    
    results = {
        "UpstreamBreaks": {
            "Tables_No_DB": tables_no_db,
            "Datasources_No_Table": datasources_no_table,
            "Workbooks_No_Datasource": workbooks_no_ds,
            "Fields_No_Source": fields_no_source
        }
    }
    
    print(json.dumps(results, indent=2))
