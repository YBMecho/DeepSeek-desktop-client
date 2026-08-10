#!/usr/bin/env bash
# DeepSeek Linux 一键构建脚本
# 构建 Windows 安装包 (NSIS) 和便携版 (ZIP)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$HOME/.local/node-linux/bin"
COREPACK_SHIMS="$HOME/.local/node-linux/lib/node_modules/corepack/shims"
PROXY="http://127.0.0.1:10808"
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
OUTPUT_DIR="$PROJECT_ROOT/output"

# 颜色
GREEN="\033[92m"
YELLOW="\033[93m"
CYAN="\033[96m"
RESET="\033[0m"

log() { echo -e "${GREEN}[$(date +%H:%M:%S)] $1${RESET}"; }
log_y() { echo -e "${YELLOW}[$(date +%H:%M:%S)] $1${RESET}"; }
run() {
    echo -e "${CYAN}[$(date +%H:%M:%S)] 执行: $1${RESET}"
    export PATH="$NODE_BIN:$COREPACK_SHIMS:$PATH"
    export https_proxy="$PROXY" http_proxy="$PROXY" ELECTRON_MIRROR="$ELECTRON_MIRROR"
    eval "$1"
}

echo "=================================================="
log "DeepSeek Linux 一键构建开始"
echo "=================================================="
log "Node 路径: $NODE_BIN"

# 读取版本
VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
log "版本: $VERSION"

# 清理
log_y "清理旧构建产物..."
rm -rf "$PROJECT_ROOT/dist" "$OUTPUT_DIR"

# 构建 NSIS
echo "=================================================="
log "开始构建 NSIS 安装包..."
echo "=================================================="
run "npx electron-builder --win --x64"

NSIS_FILE="$PROJECT_ROOT/dist/DeepSeek Setup $VERSION.exe"
if [[ ! -f "$NSIS_FILE" ]]; then
    echo "[错误] NSIS 安装包未生成"
    exit 1
fi
log "NSIS 安装包生成成功"

# 构建便携版
echo "=================================================="
log "开始构建便携版..."
echo "=================================================="
WIN_UNPACKED="$PROJECT_ROOT/dist/win-unpacked"
PORTABLE_ZIP="$PROJECT_ROOT/dist/DeepSeek-$VERSION-portable.zip"
if [[ ! -d "$WIN_UNPACKED" ]]; then
    echo "[错误] win-unpacked 目录不存在"
    exit 1
fi

log "正在压缩: $WIN_UNPACKED -> $PORTABLE_ZIP"
(cd "$PROJECT_ROOT/dist" && zip -rq "$PORTABLE_ZIP" "win-unpacked")
log "便携版生成成功"

# 复制到 output
echo "=================================================="
log "复制产物到 output 目录..."
echo "=================================================="
mkdir -p "$OUTPUT_DIR"
cp "$NSIS_FILE" "$OUTPUT_DIR/"
cp "$PORTABLE_ZIP" "$OUTPUT_DIR/"

# 完成
echo "=================================================="
log "构建完成! 产物:"
for f in "$OUTPUT_DIR"/*; do
    size=$(du -h "$f" | cut -f1)
    log "  $(basename "$f") ($size)"
done
echo "=================================================="
