'' MarketPulse — 콘솔창 없는 무음 실행 (더블클릭용)
'' pythonw.exe 로 launcher.py 를 실행하므로 검은 창이 전혀 뜨지 않음

Dim fso, root, pythonw, script
Set fso    = CreateObject("Scripting.FileSystemObject")
root       = fso.GetParentFolderName(WScript.ScriptFullName)
pythonw    = root & "\.venv\Scripts\pythonw.exe"
script     = root & "\launcher.py"

CreateObject("WScript.Shell").Run _
    Chr(34) & pythonw & Chr(34) & " " & Chr(34) & script & Chr(34), _
    0, False
