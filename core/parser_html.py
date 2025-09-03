from newspaper import Article
from typing import Dict


def parse_html_article(url: str) -> Dict:
    art = Article(url, keep_article_html=True, memoize_articles=False)
    art.download()
    art.parse()
    try:
        art.nlp()
    except:
        pass
    return {
        "url": url,
        "domain": art.source_url or "",
        "doc_type": "html",
        "title": art.title or "",
        "authors": art.authors or [],
        "published_at": art.publish_date or None,
        "text": art.text or "",
        "top_image": getattr(art, "top_image", None),
        "images": list(getattr(art, "images", []))[:50],
        "tables_json": None,
        "figures": [],
        "raw_html": art.html or "",
    }



# Todo: Crawler 작업 수행 후 다른 url을 지닌 곳에서 동일한 링크 조회 시 제외??
"""
근데 중요한 거라고 판단 할 수도 있을 것 같음
위에 내비바나 이런 것들만 좀 제외해서 처리하고 싶은데 nav로 그냥 처리해서 뺼까....
"""