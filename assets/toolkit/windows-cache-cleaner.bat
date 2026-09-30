@echo off
:: Check for Administrator rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [ADMIN] Script starting...
) else (
    echo Please right-click this file and select "Run as Administrator".
    pause
    exit
)

echo.
echo 1. CLEARING SYSTEM JUNK (Temp, %Temp%, Prefetch)...
del /s /f /q %temp%\*.*
rd /s /q %temp%
md %temp%
del /s /f /q C:\WINDOWS\Temp\*.*
rd /s /q C:\WINDOWS\Temp
md C:\WINDOWS\Temp
del /s /f /q C:\WINDOWS\Prefetch\*.*
rd /s /q C:\WINDOWS\Prefetch
md C:\WINDOWS\Prefetch

echo.
echo 2. FLUSHING DNS CACHE (Speeds up internet connection)...
ipconfig /flushdns

echo.
echo 3. OPTIMIZING DRIVES (TRIM for SSD / Defrag for HDD)...
:: This uses the /O flag which detects your SSD vs HDD automatically
defrag C: /O
defrag D: /O

echo.
echo 4. RUNNING SYSTEM FILE CHECKER (Repairing Windows errors)...
sfc /scannow

echo.
echo CLEANUP COMPLETE! 
echo Please restart your laptop for all changes to take effect.
pause