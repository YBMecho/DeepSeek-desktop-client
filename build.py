#!/usr/bin/env python3
"""
DeepSeek 一键构建脚本 (跨平台)
支持 Windows 和 Linux
构建 Windows 安装包 (NSIS) 和便携版 (ZIP)
"""

import os
import sys
import shutil
import subprocess
import zipfile
from pathlib import Path
from datetime import datetime

# ============ 配置 ============
PROJECT_ROOT = Path(__file__).parent.resolve()
PROXY = "http://127.0.0.1:10808"
ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
OUTPUT_DIR = PROJECT_ROOT / "output"

IS_WINDOWS = sys.platform == "win32"

# 颜色输出
class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    RESET = "\033[0m"

def setup_colors():
    """Windows 启用 ANSI 颜色支持"""
    if IS_WINDOWS:
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            # 禁用颜色如果 ANSI 不支持
            for attr in vars(Colors):
                if not attr.startswith("_"):
                    setattr(Colors, attr, "")

setup_colors()

def log(msg, color=Colors.GREEN):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] {msg}{Colors.RESET}")

def get_node_paths():
    """根据平台获取 Node.js 路径"""
    if IS_WINDOWS:
        # Windows: 从 PATH 中查找 node
        node_dir = None
        for p in os.environ.get("PATH", "").split(";"):
            if "nodejs" in p.lower() or "node" in p.lower():
                if (Path(p) / "node.exe").exists():
                    node_dir = Path(p)
                    break
        if not node_dir:
            # 尝试默认安装路径
            default = Path(r"C:\Program Files\nodejs")
            if (default / "node.exe").exists():
                node_dir = default
        if not node_dir:
            # 尝试 nvm-windows
            nvm = Path(os.environ.get("APPDATA", "")) / "nvm"
            if nvm.exists():
                versions = sorted(nvm.glob("v*"), reverse=True)
                for v in versions:
                    if (v / "node.exe").exists():
                        node_dir = v
                        break
        return (node_dir, Path(""))
    else:
        # Linux: 使用本地安装路径
        node_bin = Path.home() / ".local/node-linux/bin"
        corepack_shims = Path.home() / ".local/node-linux/lib/node_modules/corepack/shims"
        if (node_bin / "node").exists():
            return (node_bin, corepack_shims)
        return (Path(""), Path(""))

NODE_BIN, COREPACK_SHIMS = get_node_paths()

def run(cmd, **kwargs):
    """执行命令并实时输出"""
    log(f"执行: {cmd}", Colors.CYAN)
    env = os.environ.copy()
    
    # 设置 PATH
    path_parts = []
    if NODE_BIN and NODE_BIN != Path(""):
        path_parts.append(str(NODE_BIN))
    if COREPACK_SHIMS and COREPACK_SHIMS != Path(""):
        path_parts.append(str(COREPACK_SHIMS))
    path_parts.append(env.get("PATH", ""))
    env["PATH"] = os.pathsep.join(path_parts)
    
    env["https_proxy"] = PROXY
    env["http_proxy"] = PROXY
    env["ELECTRON_MIRROR"] = ELECTRON_MIRROR
    env.update(kwargs.pop("env", {}))
    
    result = subprocess.run(
        cmd, shell=True, cwd=PROJECT_ROOT, env=env,
        capture_output=False, **kwargs
    )
    if result.returncode != 0:
        raise RuntimeError(f"命令失败 (exit {result.returncode}): {cmd}")
    return result

def get_version():
    """从 package.json 读取版本号"""
    import json
    with open(PROJECT_ROOT / "package.json") as f:
        return json.load(f)["version"]

def build_nsis(version):
    """构建 NSIS 安装包"""
    log("=" * 50)
    log("开始构建 NSIS 安装包...")
    log("=" * 50)
    run("npx electron-builder --win --x64")
    
    nsis_file = PROJECT_ROOT / "dist" / f"DeepSeek Setup {version}.exe"
    if not nsis_file.exists():
        raise FileNotFoundError(f"NSIS 安装包未生成: {nsis_file}")
    
    log(f"NSIS 安装包生成成功: {nsis_file}")
    return nsis_file

def build_portable(version):
    """构建便携版 (ZIP)"""
    log("=" * 50)
    log("开始构建便携版...")
    log("=" * 50)
    
    win_unpacked = PROJECT_ROOT / "dist" / "win-unpacked"
    if not win_unpacked.exists():
        raise FileNotFoundError(f"win-unpacked 目录不存在: {win_unpacked}")
    
    portable_name = f"DeepSeek-{version}-portable"
    portable_zip = PROJECT_ROOT / "dist" / f"{portable_name}.zip"
    
    log(f"正在压缩: {win_unpacked} -> {portable_zip}")
    with zipfile.ZipFile(portable_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in win_unpacked.rglob("*"):
            if f.is_file():
                arcname = f.relative_to(win_unpacked.parent)
                zf.write(f, arcname)
    
    log(f"便携版生成成功: {portable_zip}")
    return portable_zip

def copy_to_output(*files):
    """复制产物到 output 目录"""
    OUTPUT_DIR.mkdir(exist_ok=True)
    copied = []
    for f in files:
        dest = OUTPUT_DIR / f.name
        shutil.copy2(f, dest)
        copied.append(dest)
        log(f"已复制: {dest}")
    return copied

def clean():
    """清理构建产物"""
    log("清理旧构建产物...", Colors.YELLOW)
    dist_dir = PROJECT_ROOT / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

def main():
    log("=" * 50)
    log(f"DeepSeek 一键构建开始 (平台: {'Windows' if IS_WINDOWS else 'Linux'})")
    log("=" * 50)
    
    if NODE_BIN and NODE_BIN != Path(""):
        log(f"Node 路径: {NODE_BIN}")
    else:
        log("使用系统 PATH 中的 Node", Colors.YELLOW)
    
    version = get_version()
    log(f"版本: {version}")
    
    # 清理
    clean()
    
    try:
        # 构建
        nsis_file = build_nsis(version)
        portable_file = build_portable(version)
        
        # 复制到 output
        log("=" * 50)
        log("复制产物到 output 目录...")
        log("=" * 50)
        copy_to_output(nsis_file, portable_file)
        
        # 完成
        log("=" * 50)
        log("构建完成! 产物:", Colors.GREEN)
        for f in sorted(OUTPUT_DIR.iterdir()):
            size_mb = f.stat().st_size / (1024 * 1024)
            log(f"  {f.name} ({size_mb:.1f} MB)")
        log("=" * 50)
        
    except Exception as e:
        log(f"构建失败: {e}", Colors.RED)
        sys.exit(1)

if __name__ == "__main__":
    main()
