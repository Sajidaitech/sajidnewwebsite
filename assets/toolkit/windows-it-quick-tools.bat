@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Windows IT Quick Tools - Disk Health ^& Troubleshooting
color 0B

:: ============================================================
:: WINDOWS IT QUICK TOOLS
:: Disk Health & Quick Windows Troubleshooting
:: Windows 11
:: Version 1.0.0
:: ============================================================

:: ---------- ADMIN CHECK ----------
net session >nul 2>&1
if %errorlevel% neq 0 (
    cls
    echo.
    echo ============================================================
    echo        ADMINISTRATOR ACCESS REQUIRED
    echo ============================================================
    echo.
    echo Restarting as Administrator...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:MENU
cls
echo.
echo ============================================================
echo             WINDOWS IT QUICK TOOLS
echo        DISK HEALTH ^& QUICK TROUBLESHOOTING
echo ============================================================
echo.
echo   [1]  Check physical disk health
echo   [2]  Check Windows volumes and free space
echo   [3]  Check system drive for file-system errors
echo   [4]  Check Windows component health
echo   [5]  Verify Windows system files
echo   [6]  Repair Windows system files
echo   [7]  Quick network troubleshooting
echo   [8]  Check Windows services
echo   [9]  Run complete quick diagnostic
echo   [0]  Exit
echo.
echo ============================================================
set /p "choice=Select an option: "

if "%choice%"=="1" goto DISK_HEALTH
if "%choice%"=="2" goto VOLUME_INFO
if "%choice%"=="3" goto CHKDSK
if "%choice%"=="4" goto DISM_CHECK
if "%choice%"=="5" goto SFC_VERIFY
if "%choice%"=="6" goto SFC_REPAIR
if "%choice%"=="7" goto NETWORK
if "%choice%"=="8" goto SERVICES
if "%choice%"=="9" goto FULL_DIAGNOSTIC
if "%choice%"=="0" goto EXIT
goto MENU


:DISK_HEALTH
cls
echo.
echo ============================================================
echo                    PHYSICAL DISK HEALTH
echo ============================================================
echo.
echo Checking physical drives...
echo.

powershell -NoProfile -Command ^
"Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus,OperationalStatus,@{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize"

echo.
echo Storage reliability information:
echo.

powershell -NoProfile -Command ^
"Get-PhysicalDisk | ForEach-Object { try { Get-StorageReliabilityCounter -PhysicalDisk $_ | Select-Object Temperature,TemperatureMax,PowerOnHours,ReadErrorsTotal,WriteErrorsTotal,Wear | Format-List } catch { Write-Host ('Reliability counters unavailable for ' + $_.FriendlyName) } }"

pause
goto MENU


:VOLUME_INFO
cls
echo.
echo ============================================================
echo                 WINDOWS VOLUME INFORMATION
echo ============================================================
echo.
echo Drive letters, file systems and free space:
echo.

powershell -NoProfile -Command ^
"Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter,FileSystemLabel,FileSystem,@{N='SizeGB';E={[math]::Round($_.Size/1GB,2)}},@{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,2)}} | Format-Table -AutoSize"

echo.
echo Disk partition information:
echo.

powershell -NoProfile -Command ^
"Get-Disk | Select-Object Number,FriendlyName,BusType,HealthStatus,OperationalStatus,@{N='SizeGB';E={[math]::Round($_.Size/1GB,2)}} | Format-Table -AutoSize"

pause
goto MENU


:CHKDSK
cls
echo.
echo ============================================================
echo              FILE-SYSTEM CHECK - SYSTEM DRIVE
echo ============================================================
echo.
echo CHKDSK /scan checks the Windows drive online.
echo It does NOT perform the aggressive /f repair automatically.
echo.
choice /C YN /M "Run CHKDSK /scan on C:"
if errorlevel 2 goto MENU

echo.
echo Running CHKDSK /scan...
echo.

chkdsk C: /scan

echo.
echo CHKDSK scan completed.
pause
goto MENU


:DISM_CHECK
cls
echo.
echo ============================================================
echo                 WINDOWS COMPONENT HEALTH
echo ============================================================
echo.
echo Running DISM CheckHealth...
echo.

DISM /Online /Cleanup-Image /CheckHealth

echo.
echo Check completed.
echo.
echo Note: CheckHealth reports whether Windows has detected
echo component-store corruption. It does not repair it.
pause
goto MENU


:SFC_VERIFY
cls
echo.
echo ============================================================
echo                SYSTEM FILE VERIFICATION
echo ============================================================
echo.
echo Running SFC /verifyonly...
echo.
echo This checks protected Windows system files without repairing.
echo.

sfc /verifyonly

echo.
echo Verification completed.
pause
goto MENU


:SFC_REPAIR
cls
echo.
echo ============================================================
echo                 SYSTEM FILE REPAIR
echo ============================================================
echo.
echo SFC will scan protected Windows files and repair corruption
echo when possible.
echo.
choice /C YN /M "Start SFC repair now"
if errorlevel 2 goto MENU

echo.
echo Running SFC /scannow...
echo.

sfc /scannow

echo.
echo SFC repair completed.
pause
goto MENU


:NETWORK
cls
echo.
echo ============================================================
echo                 QUICK NETWORK TROUBLESHOOTING
echo ============================================================
echo.

echo [1/5] IP configuration
echo ------------------------------------------------------------
ipconfig /all

echo.
echo [2/5] DNS cache
echo ------------------------------------------------------------
ipconfig /displaydns | more

echo.
echo [3/5] DNS lookup test
echo ------------------------------------------------------------
nslookup microsoft.com

echo.
echo [4/5] Internet connectivity test
echo ------------------------------------------------------------
ping 1.1.1.1 -n 4

echo.
echo [5/5] DNS connectivity test
echo ------------------------------------------------------------
ping microsoft.com -n 4

echo.
echo ============================================================
echo NETWORK TEST COMPLETE
echo ============================================================
echo.
pause
goto MENU


:SERVICES
cls
echo.
echo ============================================================
echo                 IMPORTANT WINDOWS SERVICES
echo ============================================================
echo.

powershell -NoProfile -Command ^
"Get-Service | Where-Object {$_.Name -in @('wuauserv','BITS','Winmgmt','EventLog','Dhcp','Dnscache','LanmanWorkstation','Schedule')} | Select-Object Name,DisplayName,Status,StartType | Format-Table -AutoSize"

echo.
echo This is an information-only check.
pause
goto MENU


:FULL_DIAGNOSTIC
cls
echo.
echo ============================================================
echo              COMPLETE QUICK DIAGNOSTIC
echo ============================================================
echo.
echo This performs non-destructive diagnostic checks.
echo.

echo ============================================================
echo [1] PHYSICAL DISK HEALTH
echo ============================================================
powershell -NoProfile -Command ^
"Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus,OperationalStatus,@{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize"

echo.
echo ============================================================
echo [2] VOLUME STATUS
echo ============================================================
powershell -NoProfile -Command ^
"Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter,FileSystem,HealthStatus,@{N='SizeGB';E={[math]::Round($_.Size/1GB,2)}},@{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,2)}} | Format-Table -AutoSize"

echo.
echo ============================================================
echo [3] CHKDSK ONLINE SCAN
echo ============================================================
chkdsk C: /scan

echo.
echo ============================================================
echo [4] WINDOWS COMPONENT HEALTH
echo ============================================================
DISM /Online /Cleanup-Image /CheckHealth

echo.
echo ============================================================
echo [5] SYSTEM FILE VERIFICATION
echo ============================================================
sfc /verifyonly

echo.
echo ============================================================
echo [6] NETWORK CONNECTIVITY
echo ============================================================
ping 1.1.1.1 -n 4
echo.
ping microsoft.com -n 4

echo.
echo ============================================================
echo             DIAGNOSTIC CHECK COMPLETE
echo ============================================================
echo.
echo No automatic destructive disk repair was performed.
echo Review the results above for warnings or failures.
echo.
pause
goto MENU


:EXIT
cls
echo.
echo Windows IT Quick Tools closed.
echo.
endlocal
exit /b
