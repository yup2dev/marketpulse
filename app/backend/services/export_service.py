"""
데이터 내보내기 서비스 (CSV, Excel, PDF)
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
from io import BytesIO
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

from index_analyzer.models.database import Portfolio, Holding, Transaction


class ExportService:
    """데이터 내보내기 비즈니스 로직"""

    @staticmethod
    def export_to_csv(data: List[Dict[str, Any]]) -> bytes:
        """
        데이터를 CSV로 내보내기
        """
        df = pd.DataFrame(data)
        return df.to_csv(index=False).encode('utf-8')

    @staticmethod
    def export_to_excel(data: List[Dict[str, Any]], sheet_name: str = "Data") -> bytes:
        """
        데이터를 Excel로 내보내기 (스타일 포함)
        """
        df = pd.DataFrame(data)

        # BytesIO 버퍼 생성
        output = BytesIO()

        # Excel 작성
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            # 워크북 및 워크시트 가져오기
            workbook = writer.book
            worksheet = writer.sheets[sheet_name]

            # 헤더 스타일링
            header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
            header_font = Font(bold=True, color="FFFFFF")
            header_alignment = Alignment(horizontal="center", vertical="center")

            for cell in worksheet[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = header_alignment

            # 열 너비 자동 조정
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(cell.value)
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width

        output.seek(0)
        return output.getvalue()

    @staticmethod
    def export_portfolio_to_pdf(
        portfolio: Portfolio,
        holdings: List[Holding],
        transactions: List[Transaction]
    ) -> bytes:
        """
        포트폴리오를 PDF로 내보내기
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()

        # 제목
        title = Paragraph(f"<b>Portfolio Report: {portfolio.name}</b>", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 0.2*inch))

        # 포트폴리오 정보
        info_data = [
            ["Portfolio ID:", portfolio.portfolio_id],
            ["Created:", portfolio.created_at.strftime("%Y-%m-%d") if portfolio.created_at else ""],
            ["Currency:", portfolio.currency],
            ["Benchmark:", portfolio.benchmark or "N/A"],
        ]

        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.3*inch))

        # Holdings
        if holdings:
            holdings_title = Paragraph("<b>Current Holdings</b>", styles['Heading2'])
            elements.append(holdings_title)
            elements.append(Spacer(1, 0.1*inch))

            holdings_data = [["Ticker", "Quantity", "Avg Cost", "Current Price", "P&L"]]
            for h in holdings:
                holdings_data.append([
                    h.ticker_cd,
                    f"{float(h.quantity):.2f}" if h.quantity else "0",
                    f"${float(h.avg_cost):.2f}" if h.avg_cost else "$0",
                    f"${float(h.current_price):.2f}" if h.current_price else "$0",
                    f"{float(h.unrealized_pnl_pct):.2f}%" if h.unrealized_pnl_pct else "0%"
                ])

            holdings_table = Table(holdings_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
            holdings_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(holdings_table)
            elements.append(Spacer(1, 0.3*inch))

        # Recent Transactions
        if transactions:
            txn_title = Paragraph("<b>Recent Transactions (Last 10)</b>", styles['Heading2'])
            elements.append(txn_title)
            elements.append(Spacer(1, 0.1*inch))

            txn_data = [["Date", "Type", "Ticker", "Qty", "Price"]]
            for t in transactions[:10]:  # 최근 10개만
                txn_data.append([
                    t.transaction_date.strftime("%Y-%m-%d") if t.transaction_date else "",
                    t.transaction_type.upper(),
                    t.ticker_cd,
                    f"{float(t.quantity):.2f}" if t.quantity else "0",
                    f"${float(t.price):.2f}" if t.price else "$0"
                ])

            txn_table = Table(txn_data, colWidths=[1.2*inch, 1*inch, 1.2*inch, 1*inch, 1.2*inch])
            txn_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(txn_table)

        # Footer
        elements.append(Spacer(1, 0.5*inch))
        footer = Paragraph(
            f"<i>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>",
            styles['Normal']
        )
        elements.append(footer)

        # Build PDF
        doc.build(elements)

        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def export_screener_results_to_excel(results: List[Dict[str, Any]]) -> bytes:
        """
        스크리너 결과를 Excel로 내보내기
        """
        return ExportService.export_to_excel(results, sheet_name="Screener Results")
