
from backend.models import get_engine, get_session, field_to_view, datasource_to_workbook, FieldDependency
from backend.config import Config
from sqlalchemy import text

engine = get_engine(Config.DATABASE_PATH)
session = get_session(engine)

print("Checking relationship tables options...")

ftv_count = session.execute(text("SELECT COUNT(*) FROM field_to_view")).scalar()
dtw_count = session.execute(text("SELECT COUNT(*) FROM datasource_to_workbook")).scalar()
fd_count = session.query(FieldDependency).count()

print(f"field_to_view count: {ftv_count}")
print(f"datasource_to_workbook count: {dtw_count}")
print(f"field_dependencies count: {fd_count}")
