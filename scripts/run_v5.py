import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.migrations import split_fields_table_v5
from backend.config import Config

def run_v5():
    print(f"Running V5 migration on {Config.DATABASE_PATH}...")
    split_fields_table_v5.main()
    print("Done.")

if __name__ == "__main__":
    run_v5()
