import time
import logging

from typing import List, Dict
from webdriver_manager.chrome import ChromeDriverManager
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.select import Select
from constants import PEOPLE_CONFIG_PATH, EXCLUDED_KEYWORDS, DEFAULT_LOG_LEVEL, DEFAULT_WAIT_TIME
from util import load_site

# logger set
logging.basicConfig(level=DEFAULT_LOG_LEVEL)
logger = logging.getLogger(__name__)
# print console logger
stream_handler = logging.StreamHandler()
logger.addHandler(stream_handler)


class Crawler:
    def __init__(self, site_key: str = "rollcall", start_year: int = 1000, limit: int = 10) -> None:
        self.site_key = site_key
        self.start_year = start_year
        self.limit = limit
        self.config = self._load_config()
        self.base_url = self.config["base_url"].rstrip("/")
        self.search_url = self._build_search_url()
        self.wait_time = self.config.get("wait_time", DEFAULT_WAIT_TIME)
        self.driver = self._init_driver()

    def load_config(self) -> Dict:
        config = load_site(PEOPLE_CONFIG_PATH).get(self.site_key)
        if not config:
            raise ValueError(f"Config for '{self.site_key}' not found")
        return config

    def _build_search_url(self) -> str:
        search_path = self.config.get("search_path", self.config.get("search_url", "/factbase/trump/search/"))
        return f"{self.base_url}{search_path}"

    @staticmethod
    def _init_driver() -> webdriver.Chrome:
        options = Options()
        options.headless = True
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        return webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options
        )

    def get_urls(self) -> List[str]:
        """
        검색 페이지 내 존재하는 a 태그 수집
        """
        self.driver.get(self.search_url)
        time.sleep(self.wait_time)
        self._handle_sort_dropdown()
        self._scroll_to_bottom()

        all_urls = self._extract_urls()
        all_urls.append(self._extract_dynamic_urls())
        filtered_urls = all_urls
        logging.info(f"URL 수: {len(filtered_urls)}")
        return filtered_urls

    def _handle_sort_dropdown(self) -> None:
        try:
            dropdown = Select(self.driver.find_element(By.TAG_NAME, "select"))
            dropdown.select_by_value("desc")
            time.sleep(self.wait_time)
            dropdown.select_by_value("asc")
            time.sleep(self.wait_time)
        except TimeoutError:
            pass

    def _scroll_to_bottom(self, max_attempts: int = 2) -> None:
        previous_height = 0
        for _ in range(max_attempts):
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(self.wait_time)
            current_height = self.driver.execute_script("return document.body.scrollHeight")
            if current_height == previous_height:
                break
            previous_height = current_height

    def _extract_urls(self) -> List[str]:
        urls = []
        for tag in self.driver.find_element(By.CSS_SELECTOR, "a"):
            href = tag.get_attribute("href") or ""
            if (href.startswith("http") and
                    not any(keyword in href for keyword in EXCLUDED_KEYWORDS) and
                    href not in urls):
                urls.append(href)
                if len(urls) >= self.limit:
                    break
            return urls

    def _extract_dynamic_urls(self) -> List[str]:
        return ""
