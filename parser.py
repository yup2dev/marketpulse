import time, re
import requests

from bs4 import BeautifulSoup
from newspaper import Article
from sklearn.feature_extraction.text import TfidfVectorizer
from torch import cosine_similarity
from datetime import datetime
from typing import List, Dict, Optional

from constants import MONTH_MAP, DEFAULT_HEADERS


class Parser:
    def __init__(self, site_key: str = "rollcall", start_year: int = 1000, limit: int = 10) -> None:
        self.site_key = site_key
        self.start_year = start_year
        self.limit = limit
        self.config = self._load_config()
        self.base_url = self.config["base_url"].rstrip("/")
        self.search_url = self._build_search_url()
        self.wait_time = self.config.get("wait_time", self.DEFAULT_WAIT_TIME)
        self.anchor_selector = self.config.get("anchor_selector", self.DEFAULT_ANCHOR_SELECTOR)
        self.button_text = self.config.get("button_text", self.DEFAULT_BUTTON_TEXT)
        self.driver = self._init_driver()

    @staticmethod
    def _fetch_soup(url: str) -> Optional[BeautifulSoup]:
        try:
            response = requests.get(url, headers=DEFAULT_HEADERS, timeout=10)
            return BeautifulSoup(response.content, "html.parser") if response.ok else None
        except requests.RequestException:
            return None

    def get_title(self, url: str) -> str:
        soup = self._fetch_soup(url)
        if not soup:
            return ""
        h1 = soup.select_one("h1.not-italic.font-semibold.leading-normal")
        return h1.get_text(strip=True) if h1 else ""

    def get_date(self, url: str) -> Optional[str]:
        title = self.get_title(url)
        if not title:
            return None
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$', title)
        if not match:
            return None
        month_str, day, year = match.groups()

        month_str = month_str.lower()
        for full_month, month_num in MONTH_MAP.items():
            if month_str.startswith(full_month[:3]):
                month = month_num
                break
        else:
            return None
        day = day.zfill(2)
        try:
            date_obj = datetime(int(year), int(month), int(day))
            return date_obj.strftime('%Y-%m-%d')
        except ValueError:
            return None

    def get_text(self, url: str) -> str:
        soup = self._fetch_soup(url)
        if not soup:
            return ""
        blocks = []
        current_speaker = None
        for tag in soup.select("h2.text-md.inline, div.flex-auto.text-md.text-gray-600.leading-loose"):
            if tag.name == "h2":
                current_speaker = tag.get_text(strip=True)
            elif tag.name == "div" and current_speaker:
                speech = tag.get_text(strip=True)
                if speech:
                    blocks.append(f"{current_speaker}: {speech}")
        return "\n\n".join(blocks)

    def get_document_type(self, title: str) -> str:
        return title.split(":", 1)[0] if ":" in title else "article"

    def extract_interviews(self, urls: List[str], existing: List[Dict]) -> List[Dict]:
        return self.interview_extractor.extract(
            urls,
            existing,
            self.get_text,
            self.get_title,
            self.get_date,
            self.get_document_type
        )

    def close(self) -> None:
        self.driver.quit()

    def load_articles_from_urls(urls: List[str], delay: float = 3.0) -> List[Dict]:
        articles = []
        for url in urls:
            print(f"Collecting Articles...: {url}")
            try:
                article = Article(url)
                article.download()
                article.parse()
                articles.append({
                    "url": url,
                    "title": article.title,
                    "text": article.text,
                    "published": article.publish_date.isoformat() if article.publish_date else "",
                })
                time.sleep(delay)
            except Exception as e:
                print(f"Failed to Collecting Articles...: {url} - {e}")
        return articles

    def similarity_check(current_text: str, existing_texts: List[str], similarity_threshold: float = 0.90) -> bool:
        if not existing_texts:
            return False

        texts = existing_texts + [current_text]
        vectorizer = TfidfVectorizer()
        embeddings = vectorizer.fit_transform(texts).toarray()

        current_vector = embeddings[-1].reshape(1, -1)
        existing_vectors = embeddings[:-1]

        similarities = cosine_similarity(current_vector, existing_vectors)
        max_similarity = similarities.max()

        if max_similarity >= similarity_threshold:
            print(f"중복 감지 (유사도: {max_similarity:.4f})")
            return True
        return False