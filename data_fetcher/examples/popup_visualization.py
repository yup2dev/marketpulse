"""
팝업 창으로 데이터 보여주기 (브라우저 없이)

matplotlib, tkinter, PandasGUI 등을 사용한 순수 파이썬 팝업
"""
import asyncio
import pandas as pd
from data_fetcher.router import DataRouter
from data_fetcher.utils.credentials import get_credentials_for_api


# ==================== 방법 1: Matplotlib 팝업 (가장 간단) ====================

async def matplotlib_popup():
    """
    Matplotlib로 차트 팝업 창 띄우기
    설치: pip install matplotlib
    """
    import matplotlib.pyplot as plt

    print("=" * 70)
    print("Matplotlib 팝업 창")
    print("=" * 70)

    # 데이터 가져오기
    router = DataRouter()
    credentials = get_credentials_for_api("FRED")

    gdp_data = await router.get_gdp(
        country="US",
        frequency="quarterly",
        start_date="2020-01-01",
        credentials=credentials
    )

    df = pd.DataFrame([{
        'date': d.date,
        'value': d.value,
        'growth_rate': d.growth_rate
    } for d in gdp_data])

    print(f"✓ 데이터 {len(df)}개 로드 완료\n")

    # 차트 생성
    fig, axes = plt.subplots(2, 1, figsize=(12, 8))

    # GDP 값
    axes[0].plot(df['date'], df['value'], marker='o', linewidth=2, markersize=6, color='blue')
    axes[0].set_title('US GDP (Quarterly)', fontsize=14, fontweight='bold')
    axes[0].set_ylabel('Billions of Dollars')
    axes[0].grid(True, alpha=0.3)
    axes[0].tick_params(axis='x', rotation=45)

    # 성장률
    axes[1].bar(df['date'], df['growth_rate'], color='skyblue', edgecolor='navy')
    axes[1].set_title('GDP Growth Rate (%)', fontsize=14, fontweight='bold')
    axes[1].set_xlabel('Date')
    axes[1].set_ylabel('Growth Rate (%)')
    axes[1].axhline(y=0, color='red', linestyle='--', alpha=0.5)
    axes[1].grid(True, alpha=0.3)
    axes[1].tick_params(axis='x', rotation=45)

    plt.tight_layout()

    # 팝업 창으로 표시!
    print("✓ 차트 팝업 창이 열립니다...")
    plt.show()  # 팝업 창이 열림


# ==================== 방법 2: PandasGUI (테이블 GUI) ====================

async def pandasgui_popup():
    """
    PandasGUI로 데이터를 GUI 테이블로 보기
    설치: pip install pandasgui
    """
    from pandasgui import show

    print("\n" + "=" * 70)
    print("PandasGUI 팝업")
    print("=" * 70)

    router = DataRouter()
    credentials = get_credentials_for_api("FRED")

    # 여러 데이터 가져오기
    gdp_data = await router.get_gdp(
        country="US",
        frequency="quarterly",
        start_date="2020-01-01",
        credentials=credentials
    )

    cpi_data = await router.get_cpi(
        country="US",
        start_date="2020-01-01",
        credentials=credentials
    )

    # DataFrame 변환
    df_gdp = pd.DataFrame([{
        'date': d.date,
        'value': d.value,
        'growth_rate': d.growth_rate
    } for d in gdp_data])

    df_cpi = pd.DataFrame([{
        'date': d.date,
        'value': d.value,
        'inflation_rate': d.inflation_rate
    } for d in cpi_data])

    print("✓ 데이터 로드 완료")
    print("✓ GUI 창이 열립니다 (필터링, 정렬, 차트 기능 포함)...\n")

    # GUI 창으로 표시 (여러 탭으로)
    show(GDP=df_gdp, CPI=df_cpi)


# ==================== 방법 3: Tkinter 테이블 팝업 ====================

async def tkinter_table_popup():
    """
    Tkinter로 데이터 테이블 팝업 창 만들기
    설치: 기본 내장 (별도 설치 불필요)
    """
    import tkinter as tk
    from tkinter import ttk

    print("\n" + "=" * 70)
    print("Tkinter 테이블 팝업")
    print("=" * 70)

    # 데이터 가져오기
    router = DataRouter()
    credentials = get_credentials_for_api("FRED")

    gdp_data = await router.get_gdp(
        country="US",
        frequency="quarterly",
        start_date="2023-01-01",
        credentials=credentials
    )

    df = pd.DataFrame([{
        'date': str(d.date),
        'value': f"{d.value:.2f}",
        'growth_rate': f"{d.growth_rate:.2f}%" if d.growth_rate else "N/A"
    } for d in gdp_data])

    print("✓ 데이터 로드 완료")
    print("✓ 테이블 팝업 창이 열립니다...\n")

    # Tkinter 창 생성
    root = tk.Tk()
    root.title("US GDP Data")
    root.geometry("800x600")

    # 프레임 생성
    frame = ttk.Frame(root)
    frame.pack(fill='both', expand=True, padx=10, pady=10)

    # Treeview (테이블) 생성
    tree = ttk.Treeview(frame, columns=list(df.columns), show='headings')

    # 컬럼 설정
    for col in df.columns:
        tree.heading(col, text=col.upper())
        tree.column(col, width=200, anchor='center')

    # 데이터 삽입
    for _, row in df.iterrows():
        tree.insert('', 'end', values=list(row))

    # 스크롤바
    scrollbar = ttk.Scrollbar(frame, orient='vertical', command=tree.yview)
    tree.configure(yscrollcommand=scrollbar.set)

    # 배치
    tree.pack(side='left', fill='both', expand=True)
    scrollbar.pack(side='right', fill='y')

    # 창 실행
    root.mainloop()


# ==================== 방법 4: 통합 팝업 (차트 + 테이블) ====================

async def combined_popup():
    """
    Matplotlib + Tkinter 통합 팝업
    """
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
    import tkinter as tk
    from tkinter import ttk

    print("\n" + "=" * 70)
    print("통합 팝업 (차트 + 테이블)")
    print("=" * 70)

    # 데이터 가져오기
    router = DataRouter()
    credentials = get_credentials_for_api("FRED")

    gdp_data = await router.get_gdp(
        country="US",
        frequency="quarterly",
        start_date="2022-01-01",
        credentials=credentials
    )

    df = pd.DataFrame([{
        'date': d.date,
        'value': d.value,
        'growth_rate': d.growth_rate
    } for d in gdp_data])

    print("✓ 데이터 로드 완료")
    print("✓ 통합 팝업 창이 열립니다...\n")

    # Tkinter 창 생성
    root = tk.Tk()
    root.title("US GDP Dashboard")
    root.geometry("1200x800")

    # 노트북 (탭) 생성
    notebook = ttk.Notebook(root)
    notebook.pack(fill='both', expand=True, padx=10, pady=10)

    # 탭 1: 차트
    chart_frame = ttk.Frame(notebook)
    notebook.add(chart_frame, text='📊 차트')

    # Matplotlib 차트
    fig, ax = plt.subplots(1, 1, figsize=(10, 6))
    ax.plot(df['date'], df['value'], marker='o', linewidth=2, markersize=8, color='blue')
    ax.set_title('US GDP (Quarterly)', fontsize=14, fontweight='bold')
    ax.set_xlabel('Date')
    ax.set_ylabel('Billions of Dollars')
    ax.grid(True, alpha=0.3)
    ax.tick_params(axis='x', rotation=45)
    fig.tight_layout()

    # Tkinter에 차트 삽입
    canvas = FigureCanvasTkAgg(fig, master=chart_frame)
    canvas.draw()
    canvas.get_tk_widget().pack(fill='both', expand=True)

    # 탭 2: 테이블
    table_frame = ttk.Frame(notebook)
    notebook.add(table_frame, text='📋 데이터')

    # Treeview 생성
    tree = ttk.Treeview(table_frame, columns=['date', 'value', 'growth_rate'], show='headings')
    tree.heading('date', text='Date')
    tree.heading('value', text='GDP Value')
    tree.heading('growth_rate', text='Growth Rate (%)')

    for col in ['date', 'value', 'growth_rate']:
        tree.column(col, width=300, anchor='center')

    for _, row in df.iterrows():
        tree.insert('', 'end', values=[
            row['date'],
            f"{row['value']:.2f}",
            f"{row['growth_rate']:.2f}" if pd.notna(row['growth_rate']) else "N/A"
        ])

    scrollbar = ttk.Scrollbar(table_frame, orient='vertical', command=tree.yview)
    tree.configure(yscrollcommand=scrollbar.set)

    tree.pack(side='left', fill='both', expand=True)
    scrollbar.pack(side='right', fill='y')

    # 탭 3: 통계
    stats_frame = ttk.Frame(notebook)
    notebook.add(stats_frame, text='📈 통계')

    stats_text = tk.Text(stats_frame, font=('Courier', 11))
    stats_text.pack(fill='both', expand=True, padx=10, pady=10)

    stats_info = f"""
    ========== GDP 통계 ==========

    데이터 개수: {len(df)}
    기간: {df['date'].min()} ~ {df['date'].max()}

    GDP 값:
      - 최소: ${df['value'].min():.2f}B
      - 최대: ${df['value'].max():.2f}B
      - 평균: ${df['value'].mean():.2f}B
      - 표준편차: ${df['value'].std():.2f}B

    성장률:
      - 최소: {df['growth_rate'].min():.2f}%
      - 최대: {df['growth_rate'].max():.2f}%
      - 평균: {df['growth_rate'].mean():.2f}%

    ==============================
    """

    stats_text.insert('1.0', stats_info)
    stats_text.config(state='disabled')

    # 창 실행
    root.mainloop()


# ==================== Main ====================

async def main():
    print("\n" + "=" * 70)
    print("🎯 팝업 창 시각화 (브라우저 없이)")
    print("=" * 70)
    print("\n어떤 방법으로 볼까요?")
    print("\n1. Matplotlib 차트 팝업 (간단)")
    print("2. PandasGUI 테이블 (엑셀 같은 GUI)")
    print("3. Tkinter 테이블 (기본 내장)")
    print("4. 통합 팝업 (차트 + 테이블 + 통계)")
    print("=" * 70)

    choice = input("\n번호 입력 (1-4): ").strip()

    if choice == '1':
        await matplotlib_popup()
    elif choice == '2':
        await pandasgui_popup()
    elif choice == '3':
        await tkinter_table_popup()
    elif choice == '4':
        await combined_popup()
    else:
        print("\n기본값: Matplotlib 차트 팝업")
        await matplotlib_popup()


if __name__ == "__main__":
    asyncio.run(main())
