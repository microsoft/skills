#!/usr/bin/env bash

# Installs the standalone telemetry reporter for the current operating system
# and native architecture.
#
# Exit codes:
#   0 = installed or already present
#   1 = detection, download, extraction, or installation failure
#   2 = usage or argument error

set -u
set -o pipefail

VERSION=""
TOOL_NAME="ghcfa-telem"
REPOSITORY="microsoft/GitHub-Copilot-for-Azure"

usage() {
    cat <<'EOF'
Usage: install-telemetry.sh --version <version>

Installs the matching ghcfa-telem release asset and prints the executable path.
Set AZURE_SKILLS_TELEMETRY_ZIP_PATH to copy a local ZIP instead of downloading.
EOF
}

error() {
    printf '%s\n' "$*" >&2
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --version)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                error "The --version option requires a value."
                usage >&2
                exit 2
            fi
            VERSION="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage >&2
            exit 2
            ;;
    esac
done

if [ -z "$VERSION" ]; then
    error "The --version option is required."
    usage >&2
    exit 2
fi

case "$VERSION" in
    *[!0-9A-Za-z.+-]*|.*|-*)
        error "Invalid telemetry reporter version: $VERSION"
        exit 2
        ;;
esac

OS=""
ARCHITECTURE=""
RUNTIME_IDENTIFIER=""
BINARY_NAME=""

detect_target() {
    local kernel
    local machine
    local key
    local value
    local musl_loader
    local is_musl="false"

    kernel="$(uname -s 2>/dev/null)" || {
        error "Unable to determine the operating system."
        return 1
    }
    machine="$(uname -m 2>/dev/null)" || {
        error "Unable to determine the native architecture."
        return 1
    }

    case "$kernel" in
        Linux)
            OS="linux"

            if [ -f /etc/alpine-release ]; then
                is_musl="true"
            elif [ -r /etc/os-release ]; then
                while IFS='=' read -r key value; do
                    key="$(printf '%s' "$key" | tr -d '[:space:]')"
                    value="$(printf '%s' "$value" | tr -d '[:space:]"' | tr -d "'")"
                    if [ "$key" = "ID" ] && [ "$value" = "alpine" ]; then
                        is_musl="true"
                        break
                    fi
                done < /etc/os-release
            fi

            if [ "$is_musl" = "false" ]; then
                for musl_loader in /lib/ld-musl-*.so.1; do
                    if [ -e "$musl_loader" ]; then
                        is_musl="true"
                        break
                    fi
                done
            fi

            if [ "$is_musl" = "true" ]; then
                OS="linux-musl"
            fi
            ;;
        Darwin)
            OS="osx"
            if [ "$machine" = "x86_64" ] &&
               [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || printf '0')" = "1" ]; then
                machine="arm64"
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="win"
            case "${PROCESSOR_ARCHITEW6432:-${PROCESSOR_ARCHITECTURE:-}}" in
                ARM64|arm64)
                    machine="arm64"
                    ;;
                AMD64|amd64)
                    machine="x86_64"
                    ;;
            esac
            ;;
        *)
            error "Unsupported operating system: $kernel"
            return 1
            ;;
    esac

    case "$machine" in
        x86_64|amd64|AMD64)
            ARCHITECTURE="x64"
            ;;
        arm64|aarch64|ARM64)
            ARCHITECTURE="arm64"
            ;;
        *)
            error "Unsupported native architecture: $machine"
            return 1
            ;;
    esac

    RUNTIME_IDENTIFIER="${OS}-${ARCHITECTURE}"
    if [ "$OS" = "win" ]; then
        BINARY_NAME="${TOOL_NAME}.exe"
    else
        BINARY_NAME="$TOOL_NAME"
    fi
}

get_cache_root() {
    local windows_cache

    if [ "$OS" = "win" ]; then
        windows_cache="${LOCALAPPDATA:-}"
        if [ -z "$windows_cache" ]; then
            error "LOCALAPPDATA is required to install the telemetry reporter on Windows."
            return 1
        fi
        if command -v cygpath >/dev/null 2>&1; then
            windows_cache="$(cygpath -u "$windows_cache")" || return 1
        fi
        printf '%s/GitHubCopilotForAzure/telemetry\n' "$windows_cache"
        return 0
    fi

    if [ -n "${XDG_CACHE_HOME:-}" ]; then
        printf '%s/github-copilot-for-azure/telemetry\n' "$XDG_CACHE_HOME"
        return 0
    fi

    if [ -z "${HOME:-}" ]; then
        error "HOME or XDG_CACHE_HOME is required to install the telemetry reporter."
        return 1
    fi
    printf '%s/.cache/github-copilot-for-azure/telemetry\n' "$HOME"
}

download_file() {
    local url="$1"
    local output="$2"

    if command -v curl >/dev/null 2>&1; then
        curl --fail --location --retry 3 --show-error --silent --output "$output" "$url"
        return $?
    fi

    if command -v wget >/dev/null 2>&1; then
        wget --quiet --output-document="$output" "$url"
        return $?
    fi

    error "curl or wget is required to download the telemetry reporter."
    return 1
}

detect_target || exit 1

CACHE_ROOT="$(get_cache_root)" || exit 1
INSTALL_DIRECTORY="${CACHE_ROOT}/${VERSION}/${RUNTIME_IDENTIFIER}"
BINARY_PATH="${INSTALL_DIRECTORY}/${BINARY_NAME}"

if [ "$OS" = "win" ]; then
    if [ -f "$BINARY_PATH" ]; then
        printf '%s\n' "$BINARY_PATH"
        exit 0
    fi
elif [ -x "$BINARY_PATH" ]; then
    printf '%s\n' "$BINARY_PATH"
    exit 0
fi

if ! command -v unzip >/dev/null 2>&1; then
    error "unzip is required to install the telemetry reporter."
    exit 1
fi

TEMPORARY_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/${TOOL_NAME}.XXXXXXXX" 2>/dev/null)" || {
    error "Unable to create a temporary installation directory."
    exit 1
}

cleanup() {
    rm -rf -- "$TEMPORARY_DIRECTORY"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

ASSET_NAME="${TOOL_NAME}-${VERSION}-${RUNTIME_IDENTIFIER}.zip"
ARCHIVE_PATH="${TEMPORARY_DIRECTORY}/${ASSET_NAME}"
EXTRACT_DIRECTORY="${TEMPORARY_DIRECTORY}/extracted"
MATCHES_FILE="${TEMPORARY_DIRECTORY}/matches.txt"

mkdir -p -- "$EXTRACT_DIRECTORY" || {
    error "Unable to create the temporary extraction directory."
    exit 1
}

if [ -n "${AZURE_SKILLS_TELEMETRY_ZIP_PATH:-}" ]; then
    if [ ! -f "$AZURE_SKILLS_TELEMETRY_ZIP_PATH" ]; then
        error "Telemetry ZIP not found: $AZURE_SKILLS_TELEMETRY_ZIP_PATH"
        exit 1
    fi
    cp -- "$AZURE_SKILLS_TELEMETRY_ZIP_PATH" "$ARCHIVE_PATH" || {
        error "Unable to copy telemetry ZIP: $AZURE_SKILLS_TELEMETRY_ZIP_PATH"
        exit 1
    }
else
    DOWNLOAD_URL="https://github.com/${REPOSITORY}/releases/download/${TOOL_NAME}-${VERSION}/${ASSET_NAME}"
    download_file "$DOWNLOAD_URL" "$ARCHIVE_PATH" || {
        error "Unable to download telemetry reporter from $DOWNLOAD_URL"
        exit 1
    }
fi

unzip -q "$ARCHIVE_PATH" -d "$EXTRACT_DIRECTORY" || {
    error "Unable to extract telemetry ZIP: $ARCHIVE_PATH"
    exit 1
}

find "$EXTRACT_DIRECTORY" -type f -name "$BINARY_NAME" > "$MATCHES_FILE" || {
    error "Unable to inspect the extracted telemetry ZIP."
    exit 1
}

MATCH_COUNT=0
EXTRACTED_BINARY=""
while IFS= read -r match; do
    MATCH_COUNT=$((MATCH_COUNT + 1))
    EXTRACTED_BINARY="$match"
done < "$MATCHES_FILE"

if [ "$MATCH_COUNT" -eq 0 ]; then
    error "The telemetry ZIP does not contain $BINARY_NAME."
    exit 1
fi
if [ "$MATCH_COUNT" -gt 1 ]; then
    error "The telemetry ZIP contains multiple files named $BINARY_NAME."
    exit 1
fi

mkdir -p -- "$INSTALL_DIRECTORY" || {
    error "Unable to create telemetry installation directory: $INSTALL_DIRECTORY"
    exit 1
}

STAGED_BINARY="${INSTALL_DIRECTORY}/.${BINARY_NAME}.$$.$RANDOM.tmp"
cp -- "$EXTRACTED_BINARY" "$STAGED_BINARY" || {
    error "Unable to stage the telemetry executable."
    exit 1
}

if [ "$OS" != "win" ]; then
    chmod 0755 "$STAGED_BINARY" || {
        error "Unable to make the telemetry executable runnable."
        exit 1
    }
fi

if ! mv -f -- "$STAGED_BINARY" "$BINARY_PATH"; then
    rm -f -- "$STAGED_BINARY"
    if [ ! -f "$BINARY_PATH" ]; then
        error "Unable to install the telemetry executable at $BINARY_PATH"
        exit 1
    fi
fi

printf '%s\n' "$BINARY_PATH"
