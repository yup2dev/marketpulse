"""
데이터 내보내기 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from io import BytesIO

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_active_user
from app.backend.services.export_service import ExportService
from app.backend.services.user_portfolio_service import UserPortfolioService
from index_analyzer.models.database import User

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/portfolio/{portfolio_id}/csv")
def export_portfolio_csv(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오를 CSV로 내보내기
    """
    # 포트폴리오 권한 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Holdings 조회
    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)
    holdings_data = [h.to_dict() for h in holdings]

    # CSV 생성
    csv_data = ExportService.export_to_csv(holdings_data)

    # 응답
    return StreamingResponse(
        BytesIO(csv_data),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=portfolio_{portfolio.name}_{portfolio_id}.csv"
        }
    )


@router.get("/portfolio/{portfolio_id}/excel")
def export_portfolio_excel(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오를 Excel로 내보내기
    """
    # 포트폴리오 권한 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Holdings 조회
    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)
    holdings_data = [h.to_dict() for h in holdings]

    # Excel 생성
    excel_data = ExportService.export_to_excel(holdings_data, "Holdings")

    # 응답
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=portfolio_{portfolio.name}_{portfolio_id}.xlsx"
        }
    )


@router.get("/portfolio/{portfolio_id}/pdf")
def export_portfolio_pdf(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오를 PDF로 내보내기
    """
    # 포트폴리오 권한 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Holdings 및 Transactions 조회
    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)
    transactions = UserPortfolioService.get_portfolio_transactions(db, portfolio_id)

    # PDF 생성
    pdf_data = ExportService.export_portfolio_to_pdf(portfolio, holdings, transactions)

    # 응답
    return StreamingResponse(
        BytesIO(pdf_data),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=portfolio_{portfolio.name}_{portfolio_id}.pdf"
        }
    )


@router.get("/transactions/{portfolio_id}/csv")
def export_transactions_csv(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    거래 내역을 CSV로 내보내기
    """
    # 포트폴리오 권한 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Transactions 조회
    transactions = UserPortfolioService.get_portfolio_transactions(db, portfolio_id)
    txn_data = [t.to_dict() for t in transactions]

    # CSV 생성
    csv_data = ExportService.export_to_csv(txn_data)

    # 응답
    return StreamingResponse(
        BytesIO(csv_data),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=transactions_{portfolio_id}.csv"
        }
    )
