# MarketPulse - 사용 가이드

## 크롤러 실행

```bash
python run_crawler.py
```

## 설정

`sites.yaml` 파일에서 크롤링할 사이트 설정:

```yaml
bbc:
  base_url: "https://www.bbc.com"
  seed_urls:
    - "https://www.bbc.com/news"
```

`run_crawler.py`에서 크롤링 옵션 설정:

```python
config = CrawlConfig(
    max_total=30,      # 최대 수집 기사 수
    max_depth=2,       # 크롤링 깊이
    same_domain_only=True,
)
```

## 결과 확인

### 수집된 기사 데이터
```bash
cat articles.json | python -m json.tool
```

### 다운로드된 차트 이미지
```bash
ls -lh data/images/
```

## 주요 기능

✅ **차트 이미지 자동 다운로드**
- HTML에서 차트 이미지 탐지
- 병렬 다운로드 (기본 5 workers)
- 중복 방지 (URL 해시)

✅ **기사 메타데이터 추출**
- 제목, 발행일, 본문
- 차트 URL 및 로컬 경로

## 출력 형식

```json
{
  "url": "https://...",
  "title": "Article Title",
  "published_time": "2025-10-22 03:58:08",
  "text_preview": "First 300 chars...",
  "chart_urls": ["https://..."],
  "chart_images": ["data/images/article_0001_chart_xxx.jpg"],
  "depth": 1
}
```

## 참고사항

- 현대 금융 사이트는 대부분 `<canvas>`/`<svg>` 차트 사용 → `<img>` 태그만 탐지 가능
- 차트가 있는 뉴스 기사를 찾으려면 금융 블로그, 분석 사이트 추천
- Python 3.12 완벽 지원
