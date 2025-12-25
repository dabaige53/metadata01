import sqlite3
import json

db_path = 'metadata.db'

def run_query(query, params=()):
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        return str(e)

field_id = '5771bf3b-9545-126a-f486-886e8ef2d77e'

print(f"--- Checking Field: {field_id} ---")

# 1. Check unique_regular_fields
unique_field = run_query("SELECT * FROM unique_regular_fields WHERE id = ?", (field_id,))
print(f"\n[unique_regular_fields]: {len(unique_field)} found")
if unique_field:
    print(json.dumps(unique_field[0], indent=2, default=str))

# 2. Check regular_fields (instances of this unique field)
# Assuming unique_regular_fields.id links to regular_fields via name or some mapping, OR this ID is actually from regular_fields.
# Let's check if this ID exists in regular_fields directly.
regular_field = run_query("SELECT * FROM regular_fields WHERE id = ?", (field_id,))
print(f"\n[regular_fields (by ID)]: {len(regular_field)} found")
if regular_field:
    print(json.dumps(regular_field[0], indent=2, default=str))
    
# If it's a unique field, find its instances
if unique_field:
    name = unique_field[0]['name']
    instances = run_query("SELECT id, name, datasource_id FROM regular_fields WHERE name = ?", (name,))
    print(f"\n[regular_fields instances by name '{name}']: {len(instances)}")
    
    for inst in instances:
        ds_id = inst['datasource_id']
        print(f"  - Instance ID: {inst['id']}, Datasource ID: {ds_id}")
        
# Check Datasource
datasource = run_query("SELECT * FROM datasources WHERE id = ?", ("b9e53ad3-ac89-0453-5ff8-e55ce3180172",))
print(f"\n[Datasource]: {len(datasource)} found")
if datasource:
    print(json.dumps(datasource[0], indent=2, default=str))

# Check Workbook
workbook = run_query("SELECT * FROM workbooks WHERE id = ?", ("eafb3c8c-c013-bcc7-230e-651506899121",))
print(f"\n[Workbook]: {len(workbook)} found")
if workbook:
    print(json.dumps(workbook[0], indent=2, default=str))

# Check Datasource-Workbook Links
links = run_query("SELECT * FROM datasource_to_workbook WHERE datasource_id = ?", ("b9e53ad3-ac89-0453-5ff8-e55ce3180172",))
print(f"\n[Datasource-Workbook Links]: {len(links)} found")
if links:
    print(json.dumps(links, indent=2, default=str))

# Check Lineage
lineage = run_query("SELECT * FROM regular_field_full_lineage WHERE field_id = ?", ("5771bf3b-9545-126a-f486-886e8ef2d77e",))
print(f"\n[regular_field_full_lineage]: {len(lineage)} found")
if lineage:
    print(json.dumps(lineage, indent=2, default=str))


# Check Views
views = run_query("SELECT * FROM regular_field_to_view WHERE field_id = ?", ("5771bf3b-9545-126a-f486-886e8ef2d77e",))
print(f"\n[regular_field_to_view]: {len(views)} found")
if views:
    print(json.dumps(views, indent=2, default=str))

unique_id = 'be0bd5f5-f5d6-4779-8d29-cc26ff327aea'
print(f"\n--- Checking Unique ID: {unique_id} ---")

# Check unique_regular_fields by unique_id
unique_entry = run_query("SELECT * FROM unique_regular_fields WHERE id = ?", (unique_id,))
print(f"\n[unique_regular_fields (by unique_id)]: {len(unique_entry)} found")
if unique_entry:
    print(json.dumps(unique_entry[0], indent=2, default=str))

# Check lineage by unique_id (via field_id join if needed, but the previous query used field_id directly)
# Let's see if ANY field with this unique_id has lineage
lineage_unique = run_query("""
    SELECT rf.id, rf.name, fl.* 
    FROM regular_fields rf
    JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
    WHERE rf.unique_id = ?
""", (unique_id,))
print(f"\n[regular_field_full_lineage (via unique_id)]: {len(lineage_unique)} found")
if lineage_unique:
    print(json.dumps(lineage_unique, indent=2, default=str))




