
from sqlalchemy import create_engine, text
import json

db_path = 'metadata.db'
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as connection:
    # 1. Broad Categories
    total_fields = connection.execute(text("SELECT COUNT(*) FROM fields")).scalar()
    native_fields = connection.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL")).scalar()
    calc_fields = connection.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 1")).scalar()

    # 2. Dependency Flow (Native -> Calculated)
    # How many Native fields are referenced by Calculated fields?
    # Note: field_dependencies.dependency_field_id points to the upstream field
    native_used_in_calc = connection.execute(text("""
        SELECT COUNT(DISTINCT dependency_field_id) 
        FROM field_dependencies fd
        JOIN fields f ON fd.dependency_field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """)).scalar()

    # 3. View Usage
    # How many Native fields are used directly in Views?
    native_used_in_view = connection.execute(text("""
        SELECT COUNT(DISTINCT f.id)
        FROM fields f
        JOIN field_to_view fv ON f.id = fv.field_id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """)).scalar()

    # 4. Strictly Unused Native Fields
    # Not used in View AND Not used in Calculation
    # We can approximate or do exact.
    # Union of IDs used in View OR Dependency
    native_totally_unused = connection.execute(text("""
        SELECT COUNT(*) FROM fields f
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
        AND f.id NOT IN (SELECT field_id FROM field_to_view)
        AND f.id NOT IN (SELECT dependency_field_id FROM field_dependencies WHERE dependency_field_id IS NOT NULL)
    """)).scalar()

    # 5. Calculated Fields Usage
    # Used in View?
    calc_used_in_view = connection.execute(text("""
        SELECT COUNT(DISTINCT f.id)
        FROM fields f
        JOIN field_to_view fv ON f.id = fv.field_id
        WHERE f.is_calculated = 1
    """)).scalar()
    
    # Unused Calculated Fields (Not used in view AND not used by other calcs?) 
    # Let's just check View usage for Calcs first, assuming end-goal is View.
    # But Calcs can depend on Calcs.
    calc_totally_unused = connection.execute(text("""
        SELECT COUNT(*) FROM fields f
        WHERE f.is_calculated = 1
        AND f.id NOT IN (SELECT field_id FROM field_to_view)
        AND f.id NOT IN (SELECT dependency_field_id FROM field_dependencies WHERE dependency_field_id IS NOT NULL)
    """)).scalar()

    results = {
        "Fields": {
            "Total": total_fields,
            "Native": {
                "Total": native_fields,
                "UsedInCalc": native_used_in_calc,
                "UsedDirectlyInView": native_used_in_view,
                "StrictlyUnused": native_totally_unused
            },
            "Calculated": {
                "Total": calc_fields,
                "UsedInView": calc_used_in_view,
                "StrictlyUnused": calc_totally_unused
            }
        }
    }
    
    print(json.dumps(results, indent=2))
