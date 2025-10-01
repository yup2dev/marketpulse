import os
import yaml
import logging
from typing import List, Any

from ..models.schemas import SiteConfig

log = logging.getLogger("multiseed-extractor")

try:
    from constants import SITES_CONFIG_PATH as _CONST_SITES_CFG  # type: ignore
except Exception:
    _CONST_SITES_CFG = os.environ.get("SITES_CONFIG_PATH", "./sites.yaml")


class ConfigLoader:
    @staticmethod
    def load_sites(path: str = _CONST_SITES_CFG) -> List[SiteConfig]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except FileNotFoundError:
            log.warning("Config file not found: %s", path)
            return []
        except Exception as e:
            log.warning("Config load failed: %s", e)
            return []
        out: List[SiteConfig] = []
        for key, val in (data or {}).items():
            if not isinstance(val, dict):
                continue
            base = val.get("base_url")
            seeds = val.get("seed_urls") or []
            allow = val.get("article_allow") or []
            deny = val.get("article_deny") or []
            seed_list: List[str] = []
            ConfigLoader._add(seed_list, seeds)
            out.append(SiteConfig(name=key, base_url=base, seed_urls=seed_list, article_allow=allow, article_deny=deny))
        return out

    @staticmethod
    def _add(acc: List[str], x: Any) -> None:
        if isinstance(x, str) and x.strip():
            acc.append(x.strip())
        elif isinstance(x, (list, tuple, set)):
            for y in x:
                ConfigLoader._add(acc, y)