import sqlite3

conn = sqlite3.connect('data/marketpulse.db')
cursor = conn.cursor()

cursor.execute('SELECT news_id, title, url, substr(content, 1, 100) as summary_preview FROM mbs_in_article LIMIT 3')

for row in cursor.fetchall():
    print(f'ID: {row[0]}')
    print(f'Title: {row[1]}')
    print(f'URL: {row[2]}')
    print(f'Summary: {row[3]}...')
    print('---')

conn.close()
