@echo off
chcp 65001 >nul
title 拼音音频下载工具

echo.
echo ========================================
echo           拼音音频下载工具
echo ========================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到Python环境
    echo.
    echo 请先安装Python：
    echo 1. 访问 https://www.python.org/downloads/
    echo 2. 下载并安装最新版本的Python
    echo 3. 安装时勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo ✅ Python环境检测正常

:: 检查requests库是否安装
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo.
    echo 📦 正在安装requests库...
    pip install requests
    if errorlevel 1 (
        echo ❌ requests库安装失败
        echo 请手动运行: pip install requests
        pause
        exit /b 1
    )
    echo ✅ requests库安装成功
)

echo.
echo 🚀 启动下载程序...
echo.

:: 运行Python脚本
python download_pinyin_audio.py

echo.
echo 程序执行完毕
pause
