import tabula
import os

# dfs = tabula.read_pdf(os.path("C:Users/TRIA/Downloads/20250818_company_874640000.pdf"), pages="all", encoding='CP949')
# len(dfs)
# print(dfs[0])

file_path = "Users/TRIA/Downloads/20250818_company_874640000.pdf"
print(os.path.basename(file_path))

dfs = tabula.read_pdf(os.path.basename(file_path), pages="all", encoding='CP949')
print(dfs)
