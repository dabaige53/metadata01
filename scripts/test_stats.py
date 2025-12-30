from backend.services.sync_manager import MetadataSync
from backend.services.tableau_client import TableauMetadataClient
from backend.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def test_stats():
    engine = create_engine(f'sqlite:///{Config.DATABASE_PATH}')
    Session = sessionmaker(bind=engine)
    session = Session()
    
    sync = MetadataSync(None, db_path=Config.DATABASE_PATH)
    sync.session = session
    
    print("Running calculate_stats()...")
    sync.calculate_stats()
    print("Done.")

if __name__ == "__main__":
    test_stats()
