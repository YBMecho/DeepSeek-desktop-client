@echo off
chcp 65001 >nul
setlocal EnableExpansion

:: DeepSeek Windows 一键构建脚本
:: 构建 Windows 安装包 (NSIS) 和便携版 (ZIP)

set PROJECT_ROOT=%~dp0
set PROXY=http://127.0.0.1:10808
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set OUTPUT_DIR=%PROJECT_ROOT%output

:: 查找 Node
set "NODE_BIN="
for %%p in (node.exe) do set "NODE_BIN=%%~dp$PATH:p"
if not defined NODE_BIN (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_BIN=C:\Program Files\nodejs\"
)
if not defined NODE_BIN (
    echo [错误] 未找到 Node.js，请确保已安装
    exit /b 1
)

echo ==================================================
echo DeepSeek Windows 一键构建开始
echo ==================================================
echo Node 路径: %NODE_BIN%

:: 读取版本号
for /f "tokens=2 delims=:, " %%a in ('findstr "version" %PROJECT_ROOT%package.json') do (
    set "VERSION=%%~a"
    set "VERSION=!VERSION:"=!"
)
echo 版本: %VERSION%

:: 清理
call :log "清理旧构建产物..."
if exist "%PROJECT_ROOT%dist" rmdir /s /q "%PROJECT_ROOT%dist"
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"

:: 构建
call :log "开始构建 NSIS 安装包..."
call :run "npx electron-builder --win --x64"

set "NSIS_FILE=%PROJECT_ROOT%dist\DeepSeek Setup %VERSION%.exe"
if not exist "%NSIS_FILE%" (
    echo [错误] NSIS 安装包未生成
    exit /b 1
)
call :log "NSIS 安装包生成成功"

call :log "开始构建便携版..."
set "WIN_UNPACKED=%PROJECT_ROOT%dist\win-unpacked"
set "PORTABLE_ZIP=%PROJECT_ROOT%dist\DeepSeek-%VERSION%-portable.zip"
if not exist "%WIN_UNPACKED%" (
    echo [错误] win-unpacked 目录不存在
    exit /b 1
)

:: 使用 PowerShell 压缩
powershell -Command "Compress-Archive -Path '%WIN_UNpacked%\*' -DestinationPath '%PORTABLE_ZIP%' -Force"
call :log "便携版生成成功"

:: 复制到 output
call :log "复制产物到 output 目录..."
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
copy "%NSIS_FILE%" "%OUTPUT_DIR%\"
copy "%PORTABLE_ZIP%" "%OUTPUT_DIR%\"

:: 完成
echo ==================================================
echo 构建完成! 产物:
for %%f in ("%OUTPUT_DIR%\*") do (
    set "size=%%~zf"
    call :log "  %%~nxf (!size! bytes)"
)
echo ==================================================
pause
exit /b 0

:log
echo [%time%] %~1
exit /b 0

:run
echo [%time%] 执行: %~1
set "PATH=%NODE_BIN%;%PATH%"
set "https_proxy=%PROXY%"
set "http_proxy=%PROXY%"
set "ELECTRON_MIRROR=%ELECTRON_MIRROR%"
call %~1
if errorlevel 1 (
    echo [错误] 命令失败: %~1
    exit /b 1
)
exit /b 0
