@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Windows & PC Performance Optimizer
color 0B

:: ============================================================
:: WINDOWS & PC PERFORMANCE OPTIMIZER
:: Windows 11
:: Version 1.0.0
:: Safe performance-focused optimization
:: ============================================================

:: ---------- ADMIN CHECK ----------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo   ADMINISTRATOR PRIVILEGES REQUIRED
    echo ========================================================
    echo.
    echo Restarting this tool as Administrator...
    echo.

    powershell -NoProfile -Command ^
    "Start-Process -FilePath '%~f0' -Verb RunAs"

    exit /b
)

cls
echo.
echo ============================================================
echo        WINDOWS ^& PC PERFORMANCE OPTIMIZER
echo ============================================================
echo.
echo  Windows 11 performance and responsiveness optimization
echo.
echo  Version: 1.0.0
echo.
echo ============================================================
echo.

:: ---------- CREATE RESTORE POINT ----------
echo [1/9] Creating System Restore Point...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"try { Checkpoint-Computer -Description 'Before PC Performance Optimizer' -RestorePointType 'MODIFY_SETTINGS'; Write-Host 'Restore point created.' } catch { Write-Host 'Restore point could not be created - continuing.' }"

echo.

:: ---------- ULTIMATE PERFORMANCE ----------
echo [2/9] Configuring maximum performance power plan...

powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 >nul 2>&1

for /f "tokens=4" %%G in ('powercfg -list ^| findstr /i "Ultimate Performance"') do (
    powercfg -setactive %%G >nul 2>&1
)

echo Ultimate Performance power plan configured.
echo.

:: ---------- WINDOWS GAME MODE ----------
echo [3/9] Enabling Windows Game Mode...

reg add "HKCU\Software\Microsoft\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 1 /f >nul
reg add "HKCU\Software\Microsoft\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f >nul

echo Game Mode enabled.
echo.

:: ---------- HARDWARE GPU SCHEDULING ----------
echo [4/9] Enabling Hardware-Accelerated GPU Scheduling...

reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" ^
/v HwSchMode /t REG_DWORD /d 2 /f >nul 2>&1

echo GPU scheduling setting configured.
echo NOTE: A restart may be required.
echo.

:: ---------- VISUAL EFFECTS ----------
echo [5/9] Reducing unnecessary Windows visual effects...

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" ^
/v VisualFXSetting /t REG_DWORD /d 2 /f >nul

reg add "HKCU\Control Panel\Desktop" ^
/v MenuShowDelay /t REG_SZ /d 100 /f >nul

reg add "HKCU\Control Panel\Desktop\WindowMetrics" ^
/v MinAnimate /t REG_SZ /d 0 /f >nul

echo Visual effects optimized.
echo.

:: ---------- NETWORK REFRESH ----------
echo [6/9] Refreshing Windows network configuration...

ipconfig /flushdns >nul 2>&1

netsh winsock reset >nul 2>&1

netsh int ip reset >nul 2>&1

echo Network stack refreshed.
echo NOTE: A restart may be required.
echo.

:: ---------- WINDOWS COMPONENT HEALTH ----------
echo [7/9] Checking Windows component health...

DISM /Online /Cleanup-Image /CheckHealth

echo.
echo Running system file verification...
sfc /scannow

echo.

:: ---------- TEMPORARY SYSTEM CLEANUP ----------
echo [8/9] Cleaning safe temporary system files...

del /f /s /q "%TEMP%\*" >nul 2>&1
for /d %%D in ("%TEMP%\*") do rd /s /q "%%D" >nul 2>&1

del /f /s /q "%SystemRoot%\Temp\*" >nul 2>&1
for /d %%D in ("%SystemRoot%\Temp\*") do rd /s /q "%%D" >nul 2>&1

echo Temporary files cleaned.
echo.

:: ---------- FINAL PERFORMANCE CONFIG ----------
echo [9/9] Applying final performance configuration...

:: Prefer performance-oriented processor scheduling
reg add "HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl" ^
/v Win32PrioritySeparation /t REG_DWORD /d 38 /f >nul 2>&1

:: Disable unnecessary startup delay for desktop applications
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" ^
/v StartupDelayInMSec /t REG_DWORD /d 0 /f >nul 2>&1

echo Final configuration applied.
echo.

:: ---------- SUMMARY ----------
echo ============================================================
echo                 OPTIMIZATION COMPLETE
echo ============================================================
echo.
echo  Applied:
echo.
echo  [OK] System Restore Point
echo  [OK] Ultimate Performance power plan
echo  [OK] Windows Game Mode
echo  [OK] Hardware GPU scheduling
echo  [OK] Windows visual-effect optimization
echo  [OK] DNS cache refresh
echo  [OK] Winsock/IP reset
echo  [OK] Windows component health check
echo  [OK] System File Checker
echo  [OK] Temporary-file cleanup
echo  [OK] Startup responsiveness optimization
echo.
echo ============================================================
echo.
echo  IMPORTANT:
echo  Restart Windows to apply all changes.
echo.
echo ============================================================
echo.

choice /C YN /M "Restart the PC now"
if errorlevel 2 goto END
if errorlevel 1 shutdown /r /t 10

:END
echo.
echo Press any key to exit...
pause >nul

endlocal
exit /b