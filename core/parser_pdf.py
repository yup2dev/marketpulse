import io, os, hashlib, requests
import pdfplumber
import fitz
import camelot

from typing import Dict, List

# import PyMuPDF

DATA_ROOT = "./data"


def _save_file(content: bytes, domain: str, url: str, ext: str) -> str:
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()
    path = os.path.join(DATA_ROOT, "raw", domain, f"{h}.{ext}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    return path


def _extract_text_pdfplumber(pdf_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()


def _extract_figures_pymupdf(pdf_bytes: bytes, save_key: str) -> List[str]:
    out = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    base = os.path.join(DATA_ROOT, "figures", save_key)
    os.makedirs(base, exist_ok=True)
    for i, page in enumerate(doc):
        for j, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            if pix.alpha:  # RGBA→RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            fp = os.path.join(base, f"p{i+1}_{j+1}.png")
            pix.save(fp)
            out.append(fp)
    return out


def _extract_tables_camelot(pdf_path: str) -> List[dict]:
    try:
        tables = camelot.read_pdf(pdf_path, pages="1-end", flavor="lattice")
        out = []
        for t in tables:
            out.append({"page": t.page, "data": t.df.values.tolist()})
        return out
    except Exception:
        return []


def parse_pdf_doc(url: str) -> Dict:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    pdf_bytes = r.content

    domain = requests.utils.urlparse(url).netloc
    pdf_path = _save_file(pdf_bytes, domain, url, "pdf")

    text = _extract_text_pdfplumber(pdf_bytes)
    save_key = hashlib.sha1(pdf_path.encode("utf-8")).hexdigest()
    figures = _extract_figures_pymupdf(pdf_bytes, save_key)
    tables = _extract_tables_camelot(pdf_path)

    title = ""
    try:
        # 간단한 제목 추정: 1페이지 상단 줄
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            first = pdf.pages[0].extract_text() or ""
            title = first.splitlines()[0][:200]
    except:
        pass

    return {
        "url": url,
        "domain": domain,
        "doc_type": "pdf",
        "title": title,
        "authors": [],
        "published_at": None,
        "text": text,
        "top_image": None,
        "images": [],
        "tables_json": tables,
        "figures": figures,
        "raw_pdf_path": pdf_path,
    }
