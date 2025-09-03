from core.yaml_loader import load_seeds
from core.discovery import discover_urls
from urllib.parse import urlparse

if __name__ == "__main__":
    cfg = load_seeds("sites.yaml")
    site = cfg["naverResearch"]
    base = site["base_url"]
    seed_urls = site["seed_urls"]

    base_domain = urlparse(base).netloc
    print("Base domain:", base_domain)
    print("Seed URLs:")
    for u in seed_urls:
        print("   -", u)

    print("\nDiscovered URLs (sample):")
    for i, u in enumerate(discover_urls(
        seed_urls,
        base_domain=base_domain,
        max_total=30,
        max_pages_per_domain=40,
        sleep_between=1,
    ), start=1):
        print(f"{i:02d}. {u}")


# Todo : BassUrl 외부로 나가는 URL은 확인하지 않도록...
# 

