import os
from dotenv import load_dotenv
load_dotenv()
DB_DSN = os.getenv("DB_DSN", "postgresql+psycopg2://user:pass@localhost:5432/analyst_crawl")