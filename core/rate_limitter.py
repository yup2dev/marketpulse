import time
from urllib.parse import urlparse


class RateLimiter:
    def __init__(self, reqs_per_domain_per_min=30):
        self.min_interval = 60.0/reqs_per_domain_per_min
        self.last = {}

    def wait(self, url: str):
        d = urlparse(url).netloc
        now = time.time()
        t = self.last.get(d, 0)
        dt = now - t
        if dt < self.min_interval:
            time.sleep(self.min_interval - dt)
        self.last[d] = time.time()