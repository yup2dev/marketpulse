"""Research Reports — PDF 임포트(애널리스트 보고서/추정치/연간보고서) 및 파일 서빙.

적재 흐름:
    POST /api/reports/upload  →  data/reports/ 에 PDF 저장 + pypdf 텍스트 추출
                              →  MBS_IN_RESEARCH_RPT 적재
조회 흐름:
    목록은 db/research_reports fetcher(/api/data/db/research_reports)가 담당.
    여기는 파일/전문 등 fetcher로 표현하기 어려운 것만 제공한다:
    GET    /api/reports/{report_id}/file   →  PDF 원본 (iframe 인라인 뷰)
    GET    /api/reports/{report_id}/text   →  추출 전문
    DELETE /api/reports/{report_id}        →  행 + 파일 삭제
"""
import logging
import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.backend.core.db import get_db
from index_analyzer.models.orm import MBS_IN_RESEARCH_RPT
from index_analyzer.utils.db import generate_id

log = logging.getLogger(__name__)
router = APIRouter()

_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_REPORTS_DIR = _PROJECT_ROOT / "data" / "reports"

_REPORT_TYPES = {"analyst", "estimates", "annual"}
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


def _safe_filename(name: str) -> str:
    """경로 구분자/특수문자를 제거한 파일명 (저장용 접미사)."""
    base = Path(name).name
    return re.sub(r"[^\w.\-]+", "_", base)[:120] or "report.pdf"


def _extract_pdf_text(data: bytes) -> tuple[str, int]:
    """PDF 바이트에서 (전문 텍스트, 페이지 수) 추출. 실패 페이지는 건너뛴다."""
    from pypdf import PdfReader

    reader = PdfReader(BytesIO(data))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:  # 개별 페이지 파싱 실패는 무시
            continue
    return "\n".join(parts).strip(), len(reader.pages)


@router.post("/reports/upload")
async def upload_report(
    file: UploadFile = File(...),
    report_type: str = Form(...),
    title: Optional[str] = Form(None),
    symbol: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    published_date: Optional[str] = Form(None),  # YYYY-MM-DD
    db: Session = Depends(get_db),
):
    """PDF 임포트 → 텍스트 추출 → MBS_IN_RESEARCH_RPT 적재."""
    if report_type not in _REPORT_TYPES:
        raise HTTPException(400, f"report_type must be one of {sorted(_REPORT_TYPES)}")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 50MB)")

    try:
        text, num_pages = _extract_pdf_text(data)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse PDF: {e}")

    pub_date = None
    if published_date:
        try:
            pub_date = datetime.strptime(published_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(400, "published_date must be YYYY-MM-DD")

    report_id = generate_id("rpt_")
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{report_id}_{_safe_filename(file.filename)}"
    (_REPORTS_DIR / stored_name).write_bytes(data)

    row = MBS_IN_RESEARCH_RPT(
        report_id=report_id,
        symbol=symbol.upper().strip() if symbol else None,
        title=(title or "").strip() or Path(file.filename).stem,
        report_type=report_type,
        source=(source or "").strip() or None,
        published_date=pub_date,
        file_name=file.filename,
        file_path=str(Path("data") / "reports" / stored_name),
        file_size=len(data),
        num_pages=num_pages,
        content_text=text or None,
    )
    db.add(row)
    db.commit()
    log.info("[reports] imported %s (%s, %d pages)", report_id, report_type, num_pages)
    return row.to_dict()


def _get_report(db: Session, report_id: str) -> MBS_IN_RESEARCH_RPT:
    row = db.query(MBS_IN_RESEARCH_RPT).filter(
        MBS_IN_RESEARCH_RPT.report_id == report_id
    ).first()
    if not row:
        raise HTTPException(404, "Report not found")
    return row


@router.get("/reports/{report_id}/file")
async def get_report_file(report_id: str, db: Session = Depends(get_db)):
    """PDF 원본 — 위젯 iframe에서 인라인으로 띄운다."""
    row = _get_report(db, report_id)
    path = _PROJECT_ROOT / row.file_path
    if not path.is_file():
        raise HTTPException(410, "PDF file missing on disk")
    return FileResponse(
        path,
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=row.file_name,
    )


@router.get("/reports/{report_id}/text")
async def get_report_text(report_id: str, db: Session = Depends(get_db)):
    """추출 전문 텍스트 (fetcher 목록에는 excerpt만 실리므로 전문은 여기서)."""
    row = _get_report(db, report_id)
    return {"report_id": row.report_id, "title": row.title, "text": row.content_text or ""}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    """보고서 행 + 저장 파일 삭제."""
    row = _get_report(db, report_id)
    path = _PROJECT_ROOT / row.file_path
    db.delete(row)
    db.commit()
    try:
        path.unlink(missing_ok=True)
    except OSError as e:
        log.warning("[reports] file delete failed %s: %s", path, e)
    return {"deleted": report_id}
