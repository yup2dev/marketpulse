from sqlalchemy import create_engine, Table, Column, String, JSON, DateTime, MetaData, Text
from sqlalchemy.dialects.postgresql import ARRAY, insert as pg_insert
from datetime import datetime, timezone
import hashlib
from typing import Dict
from core.settings import DB_DSN

engine = create_engine(DB_DSN, pool_pre_ping=True, future=True)
md = MetaData()

articles = Table(
    "articles", md,
    Column("id", String, primary_key=True),  # sha1(url)
    Column("url", String, nullable=False),
    Column("domain", String),
    Column("doc_type", String),
    Column("title", String),
    Column("authors", ARRAY(String)),                 # ← dialect ARRAY
    Column("published_at", DateTime(timezone=True)),
    Column("text", Text),
    Column("top_image", String),
    Column("images", ARRAY(String)),                  # ← dialect ARRAY
    Column("tables_json", JSON),                      # ← core JSON
    Column("figures", ARRAY(String)),                 # ← dialect ARRAY
    Column("content_hash", String),
    Column("crawled_at", DateTime(timezone=True)),
)

md.create_all(engine)


class ArticleStorage:
    def upsert(self, rec: Dict):
        rec = dict(rec)
        rec["id"] = hashlib.sha1(rec["url"].encode("utf-8")).hexdigest()
        rec["crawled_at"] = datetime.now(timezone.utc)
        content_key = (rec.get("title", "") + (rec.get("text", "")[:1000]))
        rec["content_hash"] = hashlib.sha1(content_key.encode("utf-8")).hexdigest()

        rec.setdefault("authors", [])
        rec.setdefault("images", [])
        rec.setdefault("figures", [])

        with engine.begin() as conn:
            stmt = pg_insert(articles).values(rec)
            up = stmt.on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "title": stmt.excluded.title,
                    "authors": stmt.excluded.authors,
                    "published_at": stmt.excluded.published_at,
                    "text": stmt.excluded.text,
                    "top_image": stmt.excluded.top_image,
                    "images": stmt.excluded.images,
                    "tables_json": stmt.excluded.tables_json,
                    "figures": stmt.excluded.figures,
                    "content_hash": stmt.excluded.content_hash,
                    "crawled_at": stmt.excluded.crawled_at,
                    "domain": stmt.excluded.domain,
                    "doc_type": stmt.excluded.doc_type,
                    "url": stmt.excluded.url,
                }
            )
            conn.execute(up)
