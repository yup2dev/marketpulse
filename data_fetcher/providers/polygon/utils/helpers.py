"""Polygon.io Helpers."""
POLYGON_BASE_URL = "https://api.polygon.io"


def polygon_url(path: str) -> str:
    return f"{POLYGON_BASE_URL}/{path.lstrip('/')}"


async def get_polygon_data(url: str, api_key: str, **params) -> dict | list:
    from data_fetcher.utils.async_http_client import amake_request
    params["apiKey"] = api_key
    return await amake_request(url, params=params)
