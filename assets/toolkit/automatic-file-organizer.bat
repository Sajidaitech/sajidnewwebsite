@echo off
for %%a in (*) do (
    if not "%%~xa"=="" (
        if not exist "%%~xa" mkdir "%%~xa"
        move "%%a" "%%~xa\"
    )
)