import os.path
from typing import List

import yaml

from constants import BASE_DIR, SITES_CONFIG_PATH


def resolve_sites_to_seeds(site_keys: List[str], config_path: str) -> List[str]:
    """
    여러 --site 값을 받아 seeds로 변환한다.
    - site_keys 항목이 YAML 키로 존재하면 해당 키의 seed_urls를 확장
    - YAML에 없으면, 문자열이 URL이면 그대로 seed로 사용
    - 둘 다 아니면 경고만 출력하고 스킵
    """
    seeds: List[str] = []
    conf = load_site_config(config_path)

    for s in site_keys:
        if s in conf:
            seed_urls = conf[s].get("seed_urls") or []
            if not isinstance(seed_urls, list):
                print("site '%s' seed_urls is not a list; skipping", s)
                continue
            seeds.extend([str(u) for u in seed_urls if isinstance(u, str)])
            print("site_key : %s", s)
            seeds.append(s)
        else:
            print("site '%s' not found in config and not a URL; skipping", s)
    return seeds


def load_site_config(config_path: str) -> dict:
    """YAML을 안전하게 로드. 파일 없거나 포맷 깨지면 빈 dict."""
    try:
        with open(SITES_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
            print("data :::", data)
            if not isinstance(data, dict):
                print("Config root is not a mapping: %s", type(data))
                print("none : ", data)
                return {}
            return data
    except FileNotFoundError:
        print("Config file not found: %s", config_path)
        return {}
    except Exception as e:
        print("Config load failed (%s): %s", config_path, e)
        return {}


with open("sites.yaml", "r", encoding="utf-8") as f:
    conf = yaml.safe_load(f) or {}

print("conf : ", conf)
seeds = resolve_sites_to_seeds(conf, "naver")
print(seeds)
