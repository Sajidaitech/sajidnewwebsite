@echo off
:: Check for administrative privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrative privileges.
) else (
    echo [ERROR] Please right-click and "Run as Administrator".
    pause
    exit /b
)

echo ------------------------------------------
echo 1. UPDATING SOFTWARE (via Winget)
echo ------------------------------------------
:: Updates all installed applications supported by Windows Package Manager
winget upgrade --all --include-unknown --accept-package-agreements --accept-source-agreements

echo.
echo ------------------------------------------
echo 2. UPDATING WINDOWS AND DRIVERS
echo ------------------------------------------
:: Uses the PowerShell Windows Update module to scan and install
powershell -command "Install-Module PSWindowsUpdate -Force -SkipPublisherCheck; Get-WindowsUpdate -AcceptAll -Install -AutoReboot"

echo.
echo ------------------------------------------
echo 3. SYSTEM FILE CHECK (Repair)
echo ------------------------------------------
:: Scans for corrupted system files and repairs them
sfc /scannow

echo.
echo Update process complete!
pause