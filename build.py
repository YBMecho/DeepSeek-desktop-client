# -*- coding: utf-8 -*-
"""
DeepSeek 桌面客户端构建脚本（Python 版本）

功能:
    1. 调用 electron-forge package / make 打包应用
    2. 动态修改 .iss 脚本配置（版本号、输出目录、图标等）
    3. 可选择分别构建 Squirrel 安装包、Inno Setup 安装包，或同时构建

使用方法:
    python build.py <命令> [选项]

命令:
    all          同时构建 Squirrel + Inno Setup 两种安装包（默认）
    squirrel     仅构建 electron-forge Squirrel 安装包
    inno         仅构建 Inno Setup 安装包
    package      仅执行 electron-forge package（不打安装包）
    iss:show     显示当前 .iss 脚本中的关键配置
    iss:set      修改 .iss 脚本配置并退出（需配合 --xxx 选项使用）

常用选项:
    --version <x.y.z>           指定版本号（同步修改 package.json 和 .iss）
    --app-name <名称>           修改应用名称
    --publisher <发布者>        修改发布者
    --icon <相对路径>           修改安装包图标路径
    --output-dir <相对路径>     修改 Inno Setup 输出目录
    --output-name <文件名>      修改 Inno Setup 输出文件名（不含 .exe）
    --compression <算法>        修改压缩算法 (lzma2/ultra64, lzma, zip, none)
    --no-desktop-icon           不默认勾选桌面快捷方式
    --desktop-icon              默认勾选桌面快捷方式（与 --no-desktop-icon 反向）
    --no-admin                  不要求管理员权限安装
    --admin                     要求管理员权限安装（与 --no-admin 反向）
    --lang <语言>               安装界面语言 (english, chinesesimp)
    --no-auto-launch            安装完成后不自动启动应用
    --auto-launch               安装完成后自动启动应用（与 --no-auto-launch 反向）
    --dry-run                   仅修改配置不执行构建
    --proxy <host:port>         构建过程中使用的代理地址 (例: 127.0.0.1:10808)
    -h, --help                  显示帮助

示例:
    python build.py inno --version 2.6.0 --proxy 127.0.0.1:10808
    python build.py all --no-admin --no-desktop-icon --no-auto-launch
    python build.py iss:set --publisher "MyCompany" --version 3.0.0 --dry-run
    python build.py iss:show
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# ---------- 路径与常量 ----------

PROJECT_ROOT = Path(__file__).resolve().parent
PKG_PATH = PROJECT_ROOT / "package.json"
ISS_PATH = PROJECT_ROOT / "deepseek-installer.iss"
INNO_CC_PATHS = [
    Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
    Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
]
PACKAGE_OUT_DIR = PROJECT_ROOT / "out" / "DeepSeek-win32-x64"


# ---------- 带颜色的日志工具 ----------

class LogColor:
    """ANSI 颜色常量"""
    INFO = "\033[36m"
    SUCCESS = "\033[32m"
    WARN = "\033[33m"
    ERROR = "\033[31m"
    RESET = "\033[0m"


def log(msg: str, level: str = "info") -> None:
    """
    打印带颜色前缀的日志

    Args:
        msg: 日志消息
        level: info / success / warn / error
    """
    color = {
        "info": LogColor.INFO,
        "success": LogColor.SUCCESS,
        "warn": LogColor.WARN,
        "error": LogColor.ERROR,
    }.get(level, LogColor.INFO)
    prefix = {
        "info": "[INFO]   ",
        "success": "[OK]     ",
        "warn": "[WARN]   ",
        "error": "[ERROR]  ",
    }.get(level, "[INFO]   ")
    print(f"{color}{prefix}{msg}{LogColor.RESET}", flush=True)


# ---------- 文件读写 ----------

def read_json(path: Path) -> dict:
    """读取 JSON 文件为 dict"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    """将 dict 写入 JSON 文件"""
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def read_text(path: Path) -> str:
    """读取文本文件为 str"""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_text(path: Path, data: str) -> None:
    """写入文本文件"""
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(data)


def run(cmd: str, env: dict | None = None) -> None:
    """
    同步执行 shell 命令并实时输出

    Args:
        cmd: 命令字符串
        env: 额外环境变量（会合并进当前进程环境）
    """
    log(f"执行: {cmd}")
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    subprocess.run(cmd, shell=True, cwd=str(PROJECT_ROOT), env=full_env, check=True)


# ---------- .iss 脚本读写 ----------

def get_iss_macro(text: str, key: str) -> str | None:
    """
    从 .iss 文本中提取 #define 宏的值

    Args:
        text: .iss 文件内容
        key: 宏名称（如 MyAppName / MyAppVersion）
    """
    m = re.search(rf'^\s*#define\s+{key}\s+"([^"]*)"', text, flags=re.M)
    return m.group(1) if m else None


def set_iss_macro(text: str, key: str, value: str) -> str:
    """
    替换 .iss 文本中 #define 宏的值

    Args:
        text: .iss 文件内容
        key: 宏名称
        value: 新值
    """
    return re.sub(
        rf'^(\s*#define\s+{key}\s+")([^"]*)(")',
        lambda m: f"{m.group(1)}{value}{m.group(3)}",
        text,
        flags=re.M,
    )


def get_iss_setup(text: str, directive: str) -> str | None:
    """
    从 .iss 文本中提取 [Setup] 节指令值（不区分大小写）

    Args:
        text: .iss 文件内容
        directive: [Setup] 节指令名
    """
    m = re.search(
        rf'^\s*{re.escape(directive)}\s*=\s*(.*)',
        text,
        flags=re.M | re.I,
    )
    return m.group(1).strip() if m else None


def set_iss_setup(text: str, directive: str, value: str) -> str:
    """
    替换 .iss 文本中 [Setup] 节指令值；不存在则在 [Setup] 节末尾追加

    Args:
        text: .iss 文件内容
        directive: [Setup] 节指令名
        value: 新值
    """
    pattern = rf'^(\s*{re.escape(directive)}\s*=\s*)(.*)'
    if re.search(pattern, text, flags=re.M | re.I):
        return re.sub(
            pattern,
            lambda m: f"{m.group(1)}{value}",
            text,
            flags=re.M | re.I,
            count=1,
        )

    # [Setup] 节末尾追加
    def _append(match: re.Match) -> str:
        block = match.group(0)
        sep = "" if block.endswith("\n") else "\n"
        return f"{block}{sep}{directive}={value}\n"

    return re.sub(
        r'^\[Setup\]([\s\S]*?)(?=\n\[|\s*$)',
        _append,
        text,
        flags=re.M,
        count=1,
    )


# ---------- 应用配置 ----------

def apply_config(opts: argparse.Namespace) -> bool:
    """
    根据 CLI 选项同步修改 package.json 与 .iss 脚本

    Args:
        opts: parse_args 命名空间

    Returns:
        是否有任何实际变更
    """
    pkg = read_json(PKG_PATH)
    iss = read_text(ISS_PATH)
    changed = False

    # 版本号：同步修改 package.json + MyAppVersion 宏 + AppId + OutputBaseFilename
    if opts.version:
        old_pkg_ver = pkg.get("version")
        if old_pkg_ver != opts.version:
            pkg["version"] = opts.version
            log(f"[package.json] version: {old_pkg_ver} -> {opts.version}")
            changed = True
        iss = set_iss_macro(iss, "MyAppVersion", opts.version)
        iss = set_iss_setup(iss, "AppId", f"{{{{DEEPSEEK-DESKTOP-CLIENT-{opts.version}}}")
        old_name = get_iss_setup(iss, "OutputBaseFilename") or f"DeepSeek-{opts.version}-setup"
        new_name = re.sub(r"-\d+\.\d+\.\d+", f"-{opts.version}", old_name)
        if new_name == old_name and opts.version not in old_name:
            new_name = f"DeepSeek-{opts.version}-setup"
        iss = set_iss_setup(iss, "OutputBaseFilename", new_name)
        log(f"[.iss] 版本相关项已更新为 {opts.version}")
        changed = True

    # 应用名称
    if opts.app_name:
        iss = set_iss_macro(iss, "MyAppName", opts.app_name)
        iss = set_iss_macro(iss, "MyAppExeName", f"{opts.app_name}.exe")
        log(f"[.iss] MyAppName / MyAppExeName -> {opts.app_name}")
        changed = True

    # 发布者
    if opts.publisher:
        iss = set_iss_macro(iss, "MyAppPublisher", opts.publisher)
        log(f"[.iss] MyAppPublisher -> {opts.publisher}")
        changed = True

    # 图标
    if opts.icon:
        iss = set_iss_macro(iss, "MyAppIcon", opts.icon)
        log(f"[.iss] MyAppIcon -> {opts.icon}")
        changed = True

    # 输出目录
    if opts.output_dir:
        iss = set_iss_setup(iss, "OutputDir", opts.output_dir)
        log(f"[.iss] OutputDir -> {opts.output_dir}")
        changed = True

    # 输出文件名
    if opts.output_name:
        iss = set_iss_setup(iss, "OutputBaseFilename", opts.output_name)
        log(f"[.iss] OutputBaseFilename -> {opts.output_name}")
        changed = True

    # 压缩算法
    if opts.compression:
        iss = set_iss_setup(iss, "Compression", opts.compression)
        log(f"[.iss] Compression -> {opts.compression}")
        changed = True

    # 管理员权限
    if opts.no_admin is not None:
        value = "lowest" if opts.no_admin else "admin"
        iss = set_iss_setup(iss, "PrivilegesRequired", value)
        log(f"[.iss] PrivilegesRequired -> {value}")
        changed = True

    # 安装界面语言
    if opts.lang:
        lang_map = {
            "english": "compiler:Default.isl",
            "chinesesimp": "compiler:Languages\\ChineseSimplified.isl",
        }
        msg_file = lang_map.get(opts.lang, lang_map["english"])
        iss = re.sub(
            r'^Name:\s*"[^"]*";\s*MessagesFile:\s*"[^"]*"',
            f'Name: "{opts.lang}"; MessagesFile: "{msg_file}"',
            iss,
            count=1,
            flags=re.M,
        )
        log(f"[.iss] Language -> {opts.lang} ({msg_file})")
        changed = True

    # 桌面快捷方式默认勾选状态
    if opts.no_desktop_icon is not None:
        def _toggle_desktop_icon(line: str) -> str:
            if opts.no_desktop_icon:
                if "Flags:" in line:
                    return re.sub(r"Flags:\s*\w+[^;]*", "Flags: unchecked", line, count=1)
                return f"{line}; Flags: unchecked"
            return re.sub(r";\s*Flags:\s*unchecked\s*$", "", line)

        iss = re.sub(
            r'^(Name:\s*"desktopicon";.*)$',
            lambda m: _toggle_desktop_icon(m.group(1)),
            iss,
            count=1,
            flags=re.M,
        )
        log(
            "[.iss] 桌面快捷方式默认"
            + ("取消勾选" if opts.no_desktop_icon else "勾选")
        )
        changed = True

    # 安装后自动启动
    if opts.no_auto_launch is not None:
        if opts.no_auto_launch:
            iss = re.sub(
                r'^\[Run\][\s\S]*?(?=\n\[|\s*$)',
                "; [Run] disabled (--no-auto-launch)\n",
                iss,
                count=1,
                flags=re.M,
            )
            log("[.iss] 禁用安装后自动启动")
        else:
            app_exe = get_iss_macro(iss, "MyAppExeName") or "DeepSeek.exe"
            app_name = get_iss_macro(iss, "MyAppName") or "DeepSeek"
            replacement = (
                "[Run]\n"
                f'Filename: "{{app}}\\{app_exe}"; Description: '
                f'"{{cm:LaunchProgram,{app_name.replace("&", "&&")}}}"; '
                "Flags: nowait postinstall skipifsilent\n"
            )
            iss = re.sub(
                r'^; \[Run\] disabled.*$',
                replacement,
                iss,
                count=1,
                flags=re.M,
            )
            log("[.iss] 启用安装后自动启动")
        changed = True

    if changed:
        write_json(PKG_PATH, pkg)
        write_text(ISS_PATH, iss)
        log("配置已写入文件")
    else:
        log("未检测到配置变更")
    return changed


def show_iss_config() -> None:
    """读取并展示当前 .iss 脚本中的关键配置"""
    iss = read_text(ISS_PATH)

    def _def(key: str) -> str:
        return get_iss_macro(iss, key) or "-"

    def _setup(key: str) -> str:
        return get_iss_setup(iss, key) or "-"

    log("==========  .iss 当前关键配置  ==========", "success")
    log(f"应用名称 (MyAppName)        : {_def('MyAppName')}")
    log(f"版本号 (MyAppVersion)        : {_def('MyAppVersion')}")
    log(f"发布者 (MyAppPublisher)      : {_def('MyAppPublisher')}")
    log(f"主程序名 (MyAppExeName)      : {_def('MyAppExeName')}")
    log(f"图标 (MyAppIcon)             : {_def('MyAppIcon')}")
    log(f"应用 ID (AppId)              : {_setup('AppId')}")
    log(f"安装目录 (DefaultDirName)    : {_setup('DefaultDirName')}")
    log(f"输出目录 (OutputDir)         : {_setup('OutputDir')}")
    log(f"输出文件名 (OutputBaseFilename): {_setup('OutputBaseFilename')}")
    log(f"压缩算法 (Compression)       : {_setup('Compression')}")
    log(f"向导样式 (WizardStyle)       : {_setup('WizardStyle')}")
    log(f"权限 (PrivilegesRequired)    : {_setup('PrivilegesRequired')}")
    log("========================================", "success")


# ---------- 构建动作 ----------

def find_iscc() -> Path | None:
    """查找 ISCC.exe 编译器路径（优先 Program Files x86）"""
    for p in INNO_CC_PATHS:
        if p.exists():
            return p
    return None


def prepare_env(opts: argparse.Namespace) -> dict:
    """
    根据 --proxy 选项准备额外环境变量

    Args:
        opts: parse_args 命名空间

    Returns:
        需要追加到子进程的环境变量 dict
    """
    env: dict[str, str] = {}
    if opts.proxy:
        proxy_url = opts.proxy if opts.proxy.startswith("http") else f"http://{opts.proxy}"
        env["HTTP_PROXY"] = proxy_url
        env["HTTPS_PROXY"] = proxy_url
        env["ELECTRON_GET_USE_PROXY"] = "true"
        env["GLOBAL_AGENT_HTTP_PROXY"] = proxy_url
        env["GLOBAL_AGENT_HTTPS_PROXY"] = proxy_url
        log(f"使用代理: {proxy_url}")
    return env


def do_package(opts: argparse.Namespace) -> None:
    """执行 electron-forge package 生成应用目录"""
    log("开始执行 electron-forge package ...")
    env = prepare_env(opts)
    run("npx electron-forge package", env=env)
    log("package 完成", "success")


def build_squirrel(opts: argparse.Namespace) -> None:
    """构建 electron-forge Squirrel 安装包并打印产物信息"""
    log("开始构建 Squirrel 安装包 (electron-forge make) ...")
    env = prepare_env(opts)
    run("npx electron-forge make", env=env)
    out_dir = PROJECT_ROOT / "out" / "make" / "squirrel.windows" / "x64"
    if out_dir.exists():
        log(f"Squirrel 安装包输出目录: {out_dir}", "success")
        for f in sorted(out_dir.iterdir()):
            if f.is_file():
                size_mb = f.stat().st_size / 1024 / 1024
                log(f"  - {f.name}  ({size_mb:.2f} MB)")


def build_innosetup(opts: argparse.Namespace) -> None:
    """构建 Inno Setup 安装包（若 package 产物不存在则先执行 package）"""
    log("开始构建 Inno Setup 安装包 ...")

    iscc = find_iscc()
    if iscc is None:
        log(
            "未找到 Inno Setup 编译器 (ISCC.exe)，请先安装 Inno Setup 6.4.3",
            "error",
        )
        sys.exit(1)
    log(f"使用编译器: {iscc}")

    has_pkg = (PACKAGE_OUT_DIR / "DeepSeek.exe").exists()
    if not has_pkg:
        log("未检测到 package 产物，先执行 package ...", "warn")
        do_package(opts)
    else:
        log("已存在 package 产物，跳过 package 阶段")

    env = prepare_env(opts)
    run(f'"{iscc}" "{ISS_PATH}"', env=env)

    iss_text = read_text(ISS_PATH)
    out_rel = get_iss_setup(iss_text, "OutputDir") or "out/make/inno-setup"
    out_dir = PROJECT_ROOT / out_rel
    if out_dir.exists():
        log(f"Inno Setup 安装包输出目录: {out_dir}", "success")
        for f in sorted(out_dir.iterdir()):
            if f.is_file():
                size_mb = f.stat().st_size / 1024 / 1024
                log(f"  - {f.name}  ({size_mb:.2f} MB)")


# ---------- CLI 入口 ----------

HELP_EPILOG = """
示例:
  python build.py inno --version 2.6.0 --proxy 127.0.0.1:10808
  python build.py squirrel --proxy 127.0.0.1:10808
  python build.py all --no-admin --no-desktop-icon --no-auto-launch
  python build.py iss:set --publisher "MyCompany" --version 3.0.0 --dry-run
  python build.py iss:show
"""


def build_parser() -> argparse.ArgumentParser:
    """构造 argparse 解析器"""
    parser = argparse.ArgumentParser(
        prog="build.py",
        description="DeepSeek 桌面客户端构建脚本（支持修改 iss 配置 & 分开打两种包）",
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "command",
        nargs="?",
        default="all",
        choices=["all", "squirrel", "inno", "package", "iss:show", "iss:set"],
        help="all=两种包都打(默认) / squirrel / inno / package / iss:show / iss:set",
    )

    parser.add_argument("--version", dest="version", default=None,
                        help="指定版本号（同步修改 package.json 和 .iss）")
    parser.add_argument("--app-name", dest="app_name", default=None,
                        help="修改应用名称")
    parser.add_argument("--publisher", dest="publisher", default=None,
                        help="修改发布者")
    parser.add_argument("--icon", dest="icon", default=None,
                        help="修改安装包图标（相对路径）")
    parser.add_argument("--output-dir", dest="output_dir", default=None,
                        help="修改 Inno Setup 输出目录（相对路径）")
    parser.add_argument("--output-name", dest="output_name", default=None,
                        help="修改 Inno Setup 输出文件名（不含 .exe）")
    parser.add_argument("--compression", dest="compression", default=None,
                        help="压缩算法: lzma2/ultra64, lzma, zip, none")
    parser.add_argument("--lang", dest="lang", default=None,
                        choices=["english", "chinesesimp"],
                        help="安装界面语言")

    # 布尔开关：分别添加 --no-xxx 和 --xxx，用 None / True / False 区分
    grp1 = parser.add_mutually_exclusive_group()
    grp1.add_argument("--no-desktop-icon", dest="no_desktop_icon",
                      action="store_true", default=None,
                      help="不默认勾选桌面快捷方式")
    grp1.add_argument("--desktop-icon", dest="no_desktop_icon",
                      action="store_false",
                      help="默认勾选桌面快捷方式（反向）")

    grp2 = parser.add_mutually_exclusive_group()
    grp2.add_argument("--no-admin", dest="no_admin",
                      action="store_true", default=None,
                      help="不要求管理员权限安装")
    grp2.add_argument("--admin", dest="no_admin",
                      action="store_false",
                      help="要求管理员权限安装（反向）")

    grp3 = parser.add_mutually_exclusive_group()
    grp3.add_argument("--no-auto-launch", dest="no_auto_launch",
                      action="store_true", default=None,
                      help="安装完成后不自动启动应用")
    grp3.add_argument("--auto-launch", dest="no_auto_launch",
                      action="store_false",
                      help="安装完成后自动启动应用（反向）")

    parser.add_argument("--dry-run", dest="dry_run", action="store_true",
                        default=False, help="仅修改配置不执行构建")
    parser.add_argument("--proxy", dest="proxy", default=None,
                        help="构建过程使用的代理地址，例 127