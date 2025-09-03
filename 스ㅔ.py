import logging
import re
from urllib.parse import urlparse

from newspaper.urls import url_to_filetype, prepare_url
from tldextract import tldextract

log = logging.getLogger(__name__)


MAX_FILE_MEMO = 20000

_STRICT_DATE_REGEX_PREFIX = r'(?<=\W)'
DATE_REGEX = r'([\./\-_]{0,1}(19|20)\d{2})[\./\-_]{0,1}(([0-3]{0,1}[0-9][\./\-_])|(\w{3,5}[\./\-_]))([0-3]{0,1}[0-9][\./\-]{0,1})?'
STRICT_DATE_REGEX = _STRICT_DATE_REGEX_PREFIX + DATE_REGEX

ALLOWED_TYPES = ['html', 'htm', 'md', 'rst', 'aspx', 'jsp', 'rhtml', 'cgi',
                 'xhtml', 'jhtml', 'asp', 'shtml']

GOOD_PATHS = ['story', 'article', 'feature', 'featured', 'slides',
              'slideshow', 'gallery', 'news', 'video', 'media',
              'v', 'radio', 'press']

BAD_CHUNKS = ['careers', 'contact', 'about', 'faq', 'terms', 'privacy',
              'advert', 'preferences', 'feedback', 'info', 'browse', 'howto',
              'account', 'subscribe', 'donate', 'shop', 'admin']

BAD_DOMAINS = ['amazon', 'doubleclick', 'twitter']

def valid_url(url, verbose=False, test=False):
    """
    Is this URL a valid news-article url?

    Perform a regex check on an absolute url.

    First, perform a few basic checks like making sure the format of the url
    is right, (scheme, domain, tld).

    Second, make sure that the url isn't some static resource, check the
    file type.

    Then, search of a YYYY/MM/DD pattern in the url. News sites
    love to use this pattern, this is a very safe bet.

    Separators can be [\.-/_]. Years can be 2 or 4 digits, must
    have proper digits 1900-2099. Months and days can be
    ambiguous 2 digit numbers, one is even optional, some sites are
    liberal with their formatting also matches snippets of GET
    queries with keywords inside them. ex: asdf.php?topic_id=blahlbah
    We permit alphanumeric, _ and -.

    Our next check makes sure that a keyword is within one of the
    separators in a url (subdomain or early path separator).
    cnn.com/story/blah-blah-blah would pass due to "story".

    We filter out articles in this stage by aggressively checking to
    see if any resemblance of the source& domain's name or tld is
    present within the article title. If it is, that's bad. It must
    be a company link, like 'cnn is hiring new interns'.

    We also filter out articles with a subdomain or first degree path
    on a registered bad keyword.
    """
    # If we are testing this method in the testing suite, we actually
    # need to preprocess the url like we do in the article's constructor!
    if test:
        url = prepare_url(url)

    # 11 chars is shortest valid url length, eg: http://x.co
    if url is None or len(url) < 11:
        if verbose: print('\t%s rejected because len of url is less than 11' % url)
        return False

    r1 = ('mailto:' in url)  # TODO not sure if these rules are redundant
    r2 = ('http://' not in url) and ('https://' not in url)

    if r1 or r2:
        if verbose: print('\t%s rejected because len of url structure' % url)
        return False

    path = urlparse(url).path

    # input url is not in valid form (scheme, netloc, tld)
    if not path.startswith('/'):
        return False

    # the '/' which may exist at the end of the url provides us no information
    if path.endswith('/'):
        path = path[:-1]

    # '/story/cnn/blahblah/index.html' --> ['story', 'cnn', 'blahblah', 'index.html']
    path_chunks = [x for x in path.split('/') if len(x) > 0]

    # siphon out the file type. eg: .html, .htm, .md
    if len(path_chunks) > 0:
        file_type = url_to_filetype(url)

        # if the file type is a media type, reject instantly
        if file_type and file_type not in ALLOWED_TYPES:
            if verbose: print('\t%s rejected due to bad filetype' % url)
            return False

        last_chunk = path_chunks[-1].split('.')
        # the file type is not of use to use anymore, remove from url
        if len(last_chunk) > 1:
            path_chunks[-1] = last_chunk[-2]

    # Index gives us no information
    if 'index' in path_chunks:
        path_chunks.remove('index')

    # extract the tld (top level domain)
    tld_dat = tldextract.extract(url)
    subd = tld_dat.subdomain
    tld = tld_dat.domain.lower()

    url_slug = path_chunks[-1] if path_chunks else ''

    if tld in BAD_DOMAINS:
        if verbose: print('%s caught for a bad tld' % url)
        return False

    if len(path_chunks) == 0:
        dash_count, underscore_count = 0, 0
    else:
        dash_count = url_slug.count('-')
        underscore_count = url_slug.count('_')

    # If the url has a news slug title
    if url_slug and (dash_count > 4 or underscore_count > 4):

        if dash_count >= underscore_count:
            if tld not in [x.lower() for x in url_slug.split('-')]:
                if verbose: print('%s verified for being a slug' % url)
                return True

        if underscore_count > dash_count:
            if tld not in [x.lower() for x in url_slug.split('_')]:
                if verbose: print('%s verified for being a slug' % url)
                return True

    # There must be at least 2 subpaths
    if len(path_chunks) <= 1:
        if verbose: print('%s caught for path chunks too small' % url)
        return False

    # Check for subdomain & path red flags
    # Eg: http://cnn.com/careers.html or careers.cnn.com --> BAD
    for b in BAD_CHUNKS:
        if b in path_chunks or b == subd:
            if verbose: print('%s caught for bad chunks' % url)
            return False

    match_date = re.search(DATE_REGEX, url)

    # if we caught the verified date above, it's an article
    if match_date is not None:
        if verbose: print('%s verified for date' % url)
        return True

    for GOOD in GOOD_PATHS:
        if GOOD.lower() in [p.lower() for p in path_chunks]:
            if verbose: print('%s verified for good path' % url)
            return True

    if verbose: print('%s caught for default false' % url)
    return False


if __name__ == "__main__":
    valid_url("https://www.bbc.com/news/bbcverify", True, True)


from typing import Iterator, Tuple, Optional, Deque, Set, Dict
from collections import deque
from urllib.parse import urljoin, urlparse

class Frontier:
    def __init__(self) -> None:
        self.q: Deque[Tuple[str, int, Optional[str]]] = deque()
        self.seen: Set[str] = set()

    def push(self, url: str, depth: int, referer: Optional[str]) -> bool:
        u = url.strip()
        if not u or u in self.seen:
            return False
        self.seen.add(u)
        self.q.append((u, depth, referer))
        return True

    def pop(self) -> Optional[Tuple[str, int, Optional[str]]]:
        return self.q.popleft() if self.q else None


class Crawler:
    def __init__(self, http, classifier: URLClassifier, max_depth: int = 2, same_domain_only: bool = True):
        self.http = http
        self.cls = classifier
        self.max_depth = max_depth
        self.same_domain_only = same_domain_only

    def discover(self, seeds: list[str]) -> Iterator[str]:
        fr = Frontier()
        for s in seeds:
            fr.push(s, 0, None)

        while True:
            item = fr.pop()
            if not item:
                break
            url, depth, referer = item
            html = self.http.get_html(url, referer=referer)
            if not html:
                continue

            label = self.cls.classify(url)
            # 규칙:
            #  - category: 본문 처리 X, 단 depth < max_depth면 링크 더 탐색
            #  - article : 본문 후보로 yield, 필요 시 depth 확장 제한
            #  - unknown : depth < max_depth면 더 탐색
            if label == "article":
                yield url
                # 기사 내부는 보통 더 확장하지 않음(루프 방지/품질)
                if depth >= self.max_depth:
                    continue
            # category/unknown은 계속 확장 가능
            if depth >= self.max_depth:
                continue

            soup = BeautifulSoup(html, "lxml")
            base_domain = urlparse(url).netloc.lower()
            for a in soup.find_all("a", href=True):
                href = a.get("href", "").strip()
                if not href:
                    continue
                child = urljoin(url, href)
                if self.same_domain_only and urlparse(child).netloc.lower() != base_domain:
                    continue
                fr.push(child, depth + 1, url)
