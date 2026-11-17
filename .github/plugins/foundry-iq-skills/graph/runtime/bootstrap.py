"""Discover a supported local Python and prepare isolated, pinned plugin runtimes."""

from __future__ import annotations

import argparse
import ast
import getpass
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import sysconfig
import tempfile
import time
import venv


ROOT = Path(__file__).resolve().parent
# The plugin root: this file ships at <plugin>/graph/runtime/bootstrap.py.
PLUGIN = ROOT.parent.parent
MCP_ENTRYPOINTS = frozenset({
    "entity-apps", "entity-graph-apps", "foundry-iq-graph", "topicgraph-mcp", "topic-graph-mcp",
    "ontology-apps", "grounding-apps",
})
# MCP clients abandon a handshake after about 60 seconds; leave room for interpreter checks and server import.
MCP_SETUP_WAIT_SECONDS = 40.0


class RuntimeErrorDetail(Exception):
    pass


class SetupPending(Exception):
    pass


class UnsupportedPlatform(RuntimeErrorDetail):
    pass


UNSUPPORTED_TARGETS = {"darwin-x86_64": "macOS Intel (x86_64)"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def normalized(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def target_id() -> str:
    machine = platform.machine().lower()
    machine = {"amd64": "x86_64", "arm64": "arm64" if sys.platform == "darwin" else "aarch64"}.get(machine, machine)
    target = f"{sys.platform}-{machine}"
    if target in UNSUPPORTED_TARGETS:
        raise UnsupportedPlatform(
            f"Unsupported platform: {UNSUPPORTED_TARGETS[target]}. Foundry IQ runtimes support Windows x64, "
            "Linux x64/ARM64 and macOS Apple Silicon (arm64) only. On Apple Silicon, use a native arm64 "
            "Python, not one running under Rosetta."
        )
    return target


def asset(root: Path, record: dict) -> Path:
    relative = Path(record["file"])
    path = (root / relative).resolve()
    if relative.is_absolute() or not path.is_relative_to(root.resolve()):
        raise RuntimeErrorDetail("Runtime asset must be inside the plugin runtime directory.")
    if not path.is_file() or digest(path.read_bytes()) != record["sha256"]:
        raise RuntimeErrorDetail(f"Missing or changed runtime asset: {relative}. Reinstall the complete plugin.")
    return path


def git_ignored(path: Path, project: Path) -> bool:
    """True only when git says `path` is ignored in `project`, so the cache can't be committed or scanned."""
    git = find_program("git")
    if not git or not os.path.isabs(git):
        return False
    try:
        # The trailing separator lets folder-only patterns such as `.foundry-iq/` match a folder not yet created.
        return subprocess.run([git, "-C", str(project), "check-ignore", "-q", str(path) + os.sep],
                              stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              timeout=10, check=False).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def check_cache_location(path: Path) -> None:
    # Keep the venv, wheels and native binaries out of the plugin install and out of the user's project,
    # where they would be committed or scanned. A git-ignored project folder is fine (sandboxed harnesses
    # often allow writes only to the workspace and the temp folder); the plugin install never is.
    cwd = Path.cwd().resolve()
    project = next((folder for folder in (cwd, *cwd.parents)
                    if (folder / ".git").exists() or (folder / "pyproject.toml").is_file()
                    or (folder / "package.json").is_file()), None)
    if project is None and cwd not in (Path.home().resolve(), Path(cwd.anchor), Path(tempfile.gettempdir()).resolve()):
        project = cwd
    if path.is_relative_to(PLUGIN.resolve()) or (
            project is not None and path.is_relative_to(project) and not git_ignored(path, project)):
        raise RuntimeErrorDetail(
            "Runtime cache must be outside the plugin and the current project directory. Inside a project, "
            "use a folder that git ignores.")


def private_temp_root() -> Path:
    """A per-user folder under the temp directory, created 0700; refused if it is a link or someone else's."""
    try:
        user = getpass.getuser()
    except Exception:  # getuser raises OSError or KeyError when no login name is set
        user = str(os.getuid()) if hasattr(os, "getuid") else "user"
    user = re.sub(r"[^A-Za-z0-9_.-]", "_", user) or "user"
    root = Path(tempfile.gettempdir()) / f"foundry-iq-skills-{user}"
    try:
        os.mkdir(root, 0o700)
    except FileExistsError:
        pass  # Already created; the ownership and link checks below still run.
    info = os.lstat(root)
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode) or getattr(root, "is_junction", bool)():
        raise RuntimeErrorDetail(f"Refusing the temp folder {root}: it is a link or not a folder. Remove it, "
                                 "or set FOUNDRY_IQ_RUNTIME_CACHE.")
    if hasattr(os, "getuid"):
        if info.st_uid != os.getuid():
            raise RuntimeErrorDetail(f"Refusing the temp folder {root}: another user owns it. "
                                     "Set FOUNDRY_IQ_RUNTIME_CACHE.")
        if stat.S_IMODE(info.st_mode) & 0o077:
            os.chmod(root, 0o700)
    return root


def writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        handle, name = tempfile.mkstemp(prefix=".write-probe-", dir=path)
        os.close(handle)
        os.unlink(name)
    except OSError:  # includes PermissionError: EPERM/EACCES from macOS seatbelt or Linux landlock
        return False
    return True


def default_cache() -> Path:
    if os.name == "nt":
        path = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "foundry-iq-skills" / "runtimes"
    else:
        path = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "foundry-iq-skills" / "runtimes"
    return path.resolve()


def cache_root() -> Path:
    override = os.environ.get("FOUNDRY_IQ_RUNTIME_CACHE")
    if override:
        path = Path(override).expanduser()
        if not path.is_absolute():
            raise RuntimeErrorDetail("FOUNDRY_IQ_RUNTIME_CACHE must be an absolute external cache path.")
        path = path.resolve()
        check_cache_location(path)
        return path
    default = default_cache()
    try:
        check_cache_location(default)
        allowed = True
    except RuntimeErrorDetail:
        # The home cache sits inside a project that git doesn't ignore: use the private temp folder.
        allowed = False
    if allowed and writable(default):
        return default
    root = private_temp_root()
    fallback = root / "runtimes"
    for _ in range(2):  # before creating the subfolder, and again after
        if fallback.is_symlink() or getattr(fallback, "is_junction", bool)() or (
                os.path.lexists(fallback) and not fallback.is_dir()):
            raise RuntimeErrorDetail(f"Refusing {fallback}: it is a link or not a folder. Remove it, "
                                     "or set FOUNDRY_IQ_RUNTIME_CACHE.")
        if not writable(fallback):
            raise RuntimeErrorDetail(f"Neither {default} nor {fallback} can be written. "
                                     "Set FOUNDRY_IQ_RUNTIME_CACHE to a writable folder.")
    check_cache_location(fallback)
    reason = "isn't writable here" if allowed else "is inside a project folder that git doesn't ignore"
    print(f"Foundry IQ: {default} {reason}, so runtimes are cached in the private temp "
          f"folder {fallback}. Set FOUNDRY_IQ_RUNTIME_CACHE to choose another location.", file=sys.stderr)
    # Later lookups in this process, and every runtime it starts (including the native downloader), reuse it.
    os.environ["FOUNDRY_IQ_RUNTIME_CACHE"] = str(fallback)
    return fallback


def load_manifest(domain: str | None = None) -> dict:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if manifest["schema_version"] != 2 or (domain is not None and domain not in manifest["runtimes"]):
        raise RuntimeErrorDetail(f"Unsupported runtime: {domain}.")
    return manifest


def python_versions() -> list[str]:
    """Supported Python versions (for example "3.12"), oldest first, as recorded in the manifest."""
    return list(load_manifest()["python_versions"])


def supported_text() -> str:
    versions = python_versions()
    return versions[0] if len(versions) == 1 else ", ".join(versions[:-1]) + " or " + versions[-1]


def interpreter_binding(domain: str) -> Path:
    manifest = load_manifest(domain)
    key = digest(canonical({"runtime": manifest["runtimes"][domain], "target": target_id()}))
    return cache_root() / domain / f"interpreter-{key}.json"


def find_program(name: str) -> str | None:
    # On Windows, shutil.which before Python 3.12 checks the current folder first and returns
    # a relative path such as .\uv.CMD; skip that and search absolute PATH entries only.
    found = shutil.which(name)
    if not found or not os.path.dirname(found) or os.path.isabs(found):
        return found
    names = [name]
    extensions = [ext.lower() for ext in os.environ.get("PATHEXT", ".COM;.EXE;.BAT;.CMD").split(";") if ext]
    if os.name == "nt" and os.path.splitext(name)[1].lower() not in extensions:
        names = [name + ext for ext in extensions]
    for folder in os.environ.get("PATH", "").split(os.pathsep):
        folder = folder.strip().strip('"')
        for item in names if os.path.isabs(folder) else ():
            candidate = os.path.join(folder, item)
            if os.path.isfile(candidate) and (os.name == "nt" or os.access(candidate, os.X_OK)):
                return candidate
    return None


def discover_python() -> Path:
    failures = []
    versions = python_versions()

    def candidates():
        for binding in sorted(cache_root().glob("*/interpreter-*.json")):
            try:
                yield Path(json.loads(binding.read_text(encoding="utf-8"))["executable"])
            except (OSError, ValueError, KeyError, TypeError) as exc:
                failures.append(f"{binding}: {exc}")
        for version in reversed(versions):
            yield from version_candidates(version)

    def version_candidates(version: str):
        compact = version.replace(".", "")
        for name in (f"python{version}", f"python{version}.exe"):
            executable = find_program(name)
            if executable:
                yield Path(executable)
        launchers = []
        if os.name == "nt" and (launcher := find_program("py")):
            launchers.append([launcher, f"-{version}", "-I", "-c", "import sys; print(sys.executable)"])
        if launcher := find_program("uv"):
            launchers.append([launcher, "python", "find", version])
        for command in launchers:
            try:
                result = subprocess.run(
                    command, capture_output=True, text=True, check=False, timeout=15,
                    env={**os.environ, "UV_PYTHON_DOWNLOADS": "never", "UV_OFFLINE": "1"},
                )
                if result.returncode or not result.stdout.strip():
                    failures.append(f"{command[0]}: {result.stderr.strip() or f'no local Python {version} reported'}")
                else:
                    yield Path(result.stdout.strip())
            except (OSError, subprocess.TimeoutExpired) as exc:
                failures.append(f"{command[0]}: {exc}")
        local = os.environ.get("LOCALAPPDATA")
        roaming = os.environ.get("APPDATA")
        if local:
            yield Path(local) / "Programs" / "Python" / f"Python{compact}" / "python.exe"
        for base in (roaming, local):
            if base:
                yield from sorted((Path(base) / "uv" / "python").glob(f"cpython-{version}.*/python.exe"))
        yield from map(Path, (
            rf"C:\Python{compact}\python.exe", f"/opt/homebrew/bin/python{version}",
            f"/usr/local/bin/python{version}", f"/usr/bin/python{version}",
        ))

    seen = set()
    for candidate in candidates():
        if not candidate.is_absolute() or not candidate.is_file():
            continue
        candidate = candidate.resolve()
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            verify_python(candidate)
        except (RuntimeErrorDetail, OSError, ValueError, KeyError, TypeError) as exc:
            failures.append(f"{candidate}: {exc}")
            continue
        return candidate
    detail = "\n" + "\n".join(failures) if failures else ""
    raise RuntimeErrorDetail(
        f"No existing local Python {supported_text()} was found. Install one of these Python versions or set "
        "FOUNDRY_IQ_PYTHON to its absolute executable; no Python was downloaded or installed." + detail
    )


def select_python(action: str, binding: Path) -> Path:
    override = os.environ.get("FOUNDRY_IQ_PYTHON")
    if override:
        selected = Path(override).expanduser()
        if not selected.is_absolute():
            raise RuntimeErrorDetail(f"FOUNDRY_IQ_PYTHON must be an absolute Python {supported_text()} executable.")
    elif binding.is_file():
        record = json.loads(binding.read_text(encoding="utf-8"))
        selected = Path(record["executable"])
        if not selected.is_absolute():
            raise RuntimeErrorDetail(f"Invalid interpreter binding: {binding}.")
    elif running_version() in python_versions() and Path(sys.executable).is_file():
        selected = Path(sys.executable)
    else:
        selected = discover_python()
    if not selected.is_file():
        raise RuntimeErrorDetail(f"Selected Python executable is missing: {selected}.")
    return selected.resolve()


def running_version() -> str:
    return f"{sys.version_info[0]}.{sys.version_info[1]}"


def bind_python(binding: Path) -> None:
    binding.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=binding.parent, prefix="interpreter-", suffix=".tmp", delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(canonical({"executable": str(Path(sys.executable).resolve()), "version": sys.version}))
    try:
        temporary.replace(binding)
    finally:
        temporary.unlink(missing_ok=True)


def verify_python(selected: Path) -> None:
    code = "import json,sys;print(json.dumps({'executable':sys.executable,'version':list(sys.version_info[:2]),'detail':sys.version}))"
    try:
        result = subprocess.run([str(selected), "-I", "-c", code], text=True, capture_output=True, check=False, timeout=15)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeErrorDetail(f"Selected executable {selected} did not answer its Python probe within 15 seconds.") from exc
    if result.returncode:
        raise RuntimeErrorDetail(
            f"Selected executable {selected} failed its Python probe (exit {result.returncode}): {result.stderr.strip()}"
        )
    info = json.loads(result.stdout)
    if ".".join(map(str, info["version"])) not in python_versions() or Path(info["executable"]).resolve() != selected:
        raise RuntimeErrorDetail(
            f"Selected executable {selected} reported executable {info['executable']}, version {info['detail']}. "
            f"Select a Python {supported_text()} interpreter executable, not a launcher or another Python version."
        )


def specification(domain: str) -> tuple[dict, str, Path]:
    manifest = load_manifest(domain)
    spec = manifest["runtimes"][domain]
    version = running_version()
    if version not in manifest["python_versions"] or version not in spec["pythons"]:
        raise RuntimeErrorDetail(
            f"Python {version} is not supported; the plugin's dependency locks cover Python {supported_text()} only."
        )
    target = target_id()
    if target not in spec["pythons"][version]:
        raise RuntimeErrorDetail(f"No dependency lock is supplied for {target}. Obtain a supported platform build; do not substitute dependency versions.")
    spec = {**{name: value for name, value in spec.items() if name != "pythons"}, **spec["pythons"][version][target]}
    asset(ROOT, spec["wheel"])
    asset(ROOT, spec["lock"])
    identity = {
        "runtime": spec,
        "python": {
            "version": sys.version,
            "implementation": sys.implementation.name,
            "cache_tag": sys.implementation.cache_tag,
            "platform": sysconfig.get_platform(),
            "machine": platform.machine(),
            "executable": str(Path(sys.executable).resolve()),
        },
    }
    key = digest(canonical(identity))
    return spec, key, cache_root() / domain / f"py{version}" / key


def python_path(environment: Path) -> Path:
    return environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def child_env(environment: Path) -> dict[str, str]:
    env = os.environ.copy()
    for name in ("PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "PIP_TARGET", "PIP_PREFIX", "PIP_USER", "PIP_ROOT",
                 "FOUNDRY_IQ_LAUNCHER_PID"):
        env.pop(name, None)
    # Empty target overrides an inherited pip config without disabling package sources.
    env.update(PIP_TARGET="", PIP_ROOT="", PIP_PREFIX=str(environment), PIP_USER="false", PIP_DISABLE_PIP_VERSION_CHECK="1")
    env["PLUGIN_ROOT"] = str(PLUGIN)
    env["PYTHONUTF8"] = "1"
    return env


def checked(args: list[str], environment: Path, *, capture: bool = False) -> str:
    result = subprocess.run(
        [str(python_path(environment)), "-I", "-B", "-X", "utf8", *args], cwd=environment,
        env=child_env(environment), text=True, encoding="utf-8", check=False,
        **({"capture_output": True} if capture else {"stdout": sys.stderr}),
    )
    if result.returncode:
        raise RuntimeErrorDetail(
            "Runtime environment verification or installation failed. "
            "Check the preceding error and your configured package sources; no source fallback was attempted."
            + (f"\n{result.stderr.strip()}" if capture else "")
        )
    return result.stdout if capture else ""


def installed(environment: Path) -> dict:
    return json.loads(checked([
        "-c", ("import importlib.metadata as m,json,sys;"
               "print(json.dumps({'prefix':sys.prefix,'packages':{d.metadata['Name']:d.version for d in m.distributions()}}))"),
    ], environment, capture=True))


def verify_entrypoints(spec: dict, environment: Path) -> None:
    code = (
        "import importlib.metadata as m,json,sys;"
        "d=m.distribution(sys.argv[1]);"
        "actual={e.name:e.value for e in d.entry_points if e.group=='console_scripts'};"
        "assert actual==json.loads(sys.argv[2]),'Wheel entry points do not match the manifest'"
    )
    checked(["-c", code, spec["wheel"]["name"], json.dumps(spec["entry_points"])], environment)


def verify(spec: dict, key: str, environment: Path) -> None:
    ready = environment / "ready.json"
    instruction = "Run explicit setup with the same cache setting."
    if not ready.is_file() or not python_path(environment).is_file():
        raise RuntimeErrorDetail(f"Runtime is not prepared. {instruction}")
    record = json.loads(ready.read_text(encoding="utf-8"))
    if not isinstance(record, dict):
        raise RuntimeErrorDetail(f"Runtime ready marker must be a JSON object. {instruction}")
    if record.get("key") != key:
        raise RuntimeErrorDetail(f"Runtime ready marker does not match this artifact. {instruction}")
    actual = installed(environment)
    packages = {normalized(name): version for name, version in actual["packages"].items()}
    expected = {normalized(item["name"]): item["version"] for item in spec["dependencies"]}
    expected[normalized(spec["wheel"]["name"])] = spec["wheel"]["version"]
    if Path(actual["prefix"]).resolve() != environment.resolve() or any(packages.get(name) != version for name, version in expected.items()):
        raise RuntimeErrorDetail("Prepared runtime no longer matches its pinned wheel/dependencies. Use a new external cache and run setup; warm run will not repair it.")
    if packages != record.get("packages"):
        raise RuntimeErrorDetail("Prepared runtime package inventory changed. Use a new external cache and run setup.")
    verify_entrypoints(spec, environment)


def pid_alive(pid: int) -> bool:
    if type(pid) is not int or pid <= 0:
        raise RuntimeErrorDetail("Invalid setup owner PID; no recovery attempted.")
    if os.name == "nt":
        import ctypes
        import ctypes.wintypes as wintypes

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            if ctypes.get_last_error() == 87:  # ERROR_INVALID_PARAMETER: PID does not exist.
                return False
            return True  # Access-denied or indeterminate owners must never be reclaimed.
        try:
            code = wintypes.DWORD()
            return not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value == 259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def setup_owner(path: Path) -> int:
    record = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(record, dict) or type(record.get("pid")) is not int or record["pid"] <= 0:
        raise RuntimeErrorDetail(f"Invalid setup owner record: {path}. No recovery attempted.")
    return record["pid"]


def needs_setup(environment: Path) -> bool:
    return not (environment / "ready.json").exists() and (
        not environment.exists() or (environment / ".setup-owner.json").is_file()
        or (environment.with_suffix(".lock") / "owner.json").is_file()
    )


def recover_partial(environment: Path) -> None:
    owner = environment / ".setup-owner.json"
    if environment.exists() and owner.is_file() and not (environment / "ready.json").exists():
        if pid_alive(setup_owner(owner)):
            raise RuntimeErrorDetail("Incomplete runtime still has a live setup owner; wait for its owner.")
        if environment.is_symlink() or environment.is_junction():
            raise RuntimeErrorDetail("Setup environment is a link; no recovery attempted.")
        shutil.rmtree(environment)


def uv_sources(config: str) -> list[str]:
    sources = {}
    for line in config.splitlines():
        name, separator, raw = line.partition("=")
        section, _, option = name.rpartition(".")
        if separator and option in {"index-url", "extra-index-url", "find-links", "trusted-host"}:
            if section in {"global", "install", ":env:"}:
                sources.setdefault(option, {})[section] = ast.literal_eval(raw)
    result = []
    for option in ("index-url", "extra-index-url", "find-links", "trusted-host"):
        configured = sources.get(option, {})
        value = next((configured[section] for section in (":env:", "install", "global")
                      if section in configured), "")
        value = os.environ.get("PIP_" + option.upper().replace("-", "_"), value)
        values = [value] if option == "index-url" else str(value).split()
        for item in values:
            if item:
                result.extend(["--" + option, str(item)])
    return result


def accelerated_install(spec: dict, environment: Path, dependencies: Path, config: str) -> bool:
    uv = find_program("uv")
    if not uv or os.environ.get("PIP_NO_INDEX"):
        return False
    for line in config.splitlines():
        name, separator, raw = line.partition("=")
        if separator and name in {"global.no-index", "install.no-index", ":env:.no-index"}:
            if str(ast.literal_eval(raw)).lower() in {"true", "1", "yes", "on"}:
                return False
    commands = []
    prefix = [uv, "pip", "install", "--python", str(python_path(environment))]
    if spec["dependencies"]:
        commands.append([*prefix, *uv_sources(config), "--only-binary", ":all:",
                         "--require-hashes", "--no-deps", "-r", str(dependencies)])
    commands.append([*prefix, "--no-deps", "--no-index", str(asset(ROOT, spec["wheel"]))])
    for command in commands:
        try:
            result = subprocess.run(command, cwd=environment, env=child_env(environment),
                                    stdout=sys.stderr, check=False)
        except OSError as exc:
            print(f"uv acceleration unavailable ({type(exc).__name__}); falling back to pinned pip installation.",
                  file=sys.stderr)
            return False
        if result.returncode:
            print(f"uv acceleration failed (exit {result.returncode}); falling back to pinned pip installation.",
                  file=sys.stderr)
            return False
    return True


def setup(spec: dict, key: str, environment: Path) -> None:
    if (environment / "ready.json").is_file():
        verify(spec, key, environment)
        return
    environment.parent.mkdir(parents=True, exist_ok=True)
    lock = environment.with_suffix(".lock")
    deadline = time.monotonic() + 55
    while True:
        try:
            lock.mkdir()
            break
        except FileExistsError as exc:
            owner = lock / "owner.json"
            if not owner.is_file():
                raise RuntimeErrorDetail("Setup is already active or left an incomplete setup lock. Do not stop other processes; wait for its owner or choose a new external cache.") from exc
            pid = setup_owner(owner)
            while lock.exists() and pid_alive(pid) and time.monotonic() < deadline:
                time.sleep(0.25)
            if not lock.exists():
                if (environment / "ready.json").is_file():
                    verify(spec, key, environment)
                    return
                continue
            if pid_alive(pid):
                raise RuntimeErrorDetail("Setup owner is still active after 55 seconds; wait or choose a new external cache.")
            if lock.is_symlink() or lock.is_junction() or setup_owner(owner) != pid:
                raise RuntimeErrorDetail("Setup lock changed or is a link; no recovery attempted.")
            # Only the recorded dead owner's lock is removed; unknown entries fail closed.
            owner.unlink()
            lock.rmdir()
    created = False
    try:
        (lock / "owner.json").write_bytes(canonical({"pid": os.getpid()}))
        if (environment / "ready.json").is_file():
            verify(spec, key, environment)
            return
        recover_partial(environment)
        if environment.exists():
            raise RuntimeErrorDetail("Incomplete runtime exists. Inspect it or choose a new external cache; setup will not overwrite it.")
        environment.mkdir()
        created = True
        (environment / ".setup-owner.json").write_bytes(canonical({"pid": os.getpid()}))
        venv.EnvBuilder(with_pip=True, clear=False).create(environment)
        config = checked(["-m", "pip", "config", "list"], environment, capture=True)
        for line in config.splitlines():
            name, separator, raw = line.partition("=")
            if not separator or name.rsplit(".", 1)[-1] not in {"root", "home", "target", "prefix", "user"}:
                continue
            value = ast.literal_eval(raw)
            if not value or (name.endswith(".user") and str(value).lower() in {"false", "0", "no"}):
                continue
            if name == ":env:.prefix" and value == str(environment):
                continue
            raise RuntimeErrorDetail(
                f"Configured pip destination option {name} is incompatible with plugin isolation. "
                "Use setup configuration containing package sources/proxy settings but no installation destination overrides; no configuration was changed."
            )
        dependencies = asset(ROOT, spec["lock"])
        if not accelerated_install(spec, environment, dependencies, config):
            if spec["dependencies"]:
                checked(["-m", "pip", "install", "--no-input", "--no-user", "--prefix", str(environment),
                         "--only-binary=:all:", "--require-hashes", "--no-deps", "-r", str(dependencies)], environment)
            checked(["-m", "pip", "install", "--no-input", "--no-user", "--prefix", str(environment),
                     "--no-deps", "--no-index", str(asset(ROOT, spec["wheel"]))], environment)
        checked(["-m", "pip", "check"], environment)
        actual = installed(environment)
        packages = {normalized(name): version for name, version in actual["packages"].items()}
        expected = {normalized(item["name"]): item["version"] for item in spec["dependencies"]}
        expected[normalized(spec["wheel"]["name"])] = spec["wheel"]["version"]
        # pip/setuptools are venv provisioning tools, not runtime requirements.
        if {name: version for name, version in packages.items() if name not in {"pip", "setuptools"}} != expected:
            raise RuntimeErrorDetail("Installed package inventory does not match the complete resolved lock.")
        verify_entrypoints(spec, environment)
        temp = environment / "ready.tmp"
        temp.write_bytes(canonical({"key": key, "packages": packages}))
        (environment / ".setup-owner.json").unlink()
        temp.replace(environment / "ready.json")
        verify(spec, key, environment)
    except BaseException:
        if created:
            shutil.rmtree(environment)
        raise
    finally:
        (lock / "owner.json").unlink(missing_ok=True)
        lock.rmdir()


def setup_active(environment: Path) -> bool:
    owner = environment.with_suffix(".lock") / "owner.json"
    try:
        return owner.is_file() and pid_alive(setup_owner(owner))
    except (OSError, ValueError, RuntimeErrorDetail):
        return False


def mcp_domains(domain: str, entrypoint: str) -> list[str]:
    domains = [domain]
    if entrypoint == "foundry-iq-graph" and domain != "topicgraph":
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        if "topicgraph" in manifest.get("runtimes", {}):
            domains.append("topicgraph")
    return domains


def spawn_setup(domain: str, log) -> subprocess.Popen:
    command = [sys.executable, "-I", str(ROOT / "bootstrap.py"), "setup", domain]
    options = {"stdin": subprocess.DEVNULL, "stdout": log, "stderr": subprocess.STDOUT, "close_fds": True}
    if os.name != "nt":
        return subprocess.Popen(command, start_new_session=True, **options)
    # A hidden console lets pip/uv children run without opening windows; breakaway survives client job cleanup.
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    try:
        return subprocess.Popen(command, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **options)
    except OSError:
        return subprocess.Popen(command, creationflags=flags, **options)


def _kernel32():
    import ctypes
    import ctypes.wintypes as wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.GetProcessTimes.argtypes = (wintypes.HANDLE, *[ctypes.POINTER(ctypes.c_uint64)] * 4)
    kernel32.WaitForMultipleObjects.argtypes = (wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE), wintypes.BOOL, wintypes.DWORD)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
    kernel32.SetInformationJobObject.argtypes = (wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD)
    kernel32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
    return kernel32


def exit_with_launcher() -> None:
    """On Windows, exit as soon as the process that started bootstrap dies (the job below then ends the tree)."""
    import ctypes
    import ctypes.wintypes as wintypes
    import threading

    kernel32 = _kernel32()

    def created(handle) -> int | None:
        stamp, unused = ctypes.c_uint64(), ctypes.c_uint64()
        ok = kernel32.GetProcessTimes(handle, ctypes.byref(stamp), *[ctypes.byref(unused)] * 3)
        return stamp.value if ok else None

    own = created(kernel32.GetCurrentProcess())
    # The MCP launcher passes its PID because a Python trampoline (uv) may sit between it and bootstrap.
    pids = {os.getppid(), int(os.environ.pop("FOUNDRY_IQ_LAUNCHER_PID", "0") or 0)} - {0}
    handles = []
    for pid in pids:
        handle = kernel32.OpenProcess(0x00100000 | 0x1000, False, pid)  # SYNCHRONIZE | QUERY_LIMITED_INFORMATION
        if not handle:
            if ctypes.get_last_error() == 87:  # No such process: the launcher is already gone.
                os._exit(1)
            continue
        started = created(handle)
        if own is not None and started is not None and started > own:  # A reused PID, not our launcher.
            os._exit(1)
        handles.append(handle)
    if not handles:
        return
    array = (wintypes.HANDLE * len(handles))(*handles)

    def watch() -> None:
        kernel32.WaitForMultipleObjects(len(handles), array, False, 0xFFFFFFFF)
        os._exit(1)

    threading.Thread(target=watch, name="exit-with-launcher", daemon=True).start()


def run_attached(command: list[str], env: dict[str, str] | None = None) -> int:
    """Run a Windows child in a kill-on-close job, so its whole tree ends when bootstrap ends by any means."""
    import ctypes

    kernel32 = _kernel32()
    job = kernel32.CreateJobObjectW(None, None)
    # JOBOBJECT_EXTENDED_LIMIT_INFORMATION is 144 bytes on 64-bit Windows; LimitFlags sits at offset 16.
    limits = (ctypes.c_byte * 144)()
    # Kill on job close; explicit breakaway (detached setup, Graph Playground) stays allowed.
    ctypes.c_uint32.from_buffer(limits, 16).value = 0x2000 | 0x800
    if not job or not kernel32.SetInformationJobObject(job, 9, limits, ctypes.sizeof(limits)):
        raise ctypes.WinError(ctypes.get_last_error())
    # Start suspended so nothing the child launches can begin outside the job. The job handle stays open
    # until bootstrap exits; Windows then closes it and ends the tree.
    child = subprocess.Popen(command, env=env, creationflags=0x4)
    try:
        if not kernel32.AssignProcessToJobObject(job, int(child._handle)):
            raise ctypes.WinError(ctypes.get_last_error())
        status = ctypes.WinDLL("ntdll").NtResumeProcess(ctypes.c_void_p(int(child._handle)))
        if status:
            raise OSError(f"Could not resume the runtime process (NTSTATUS {status & 0xFFFFFFFF:#x}).")
        return child.wait()
    except BaseException as exc:
        if isinstance(exc, KeyboardInterrupt):  # Same short Ctrl+C grace as subprocess.run.
            try:
                child.wait(0.25)
            except subprocess.TimeoutExpired:
                pass  # Still running after the grace period; kill it below.
        child.kill()
        raise


def prepare_for_mcp(domain: str, entrypoint: str) -> None:
    """Prepare absent MCP runtimes in parallel, detached setups that outlive an abandoned client handshake."""
    pending = {}
    for name in mcp_domains(domain, entrypoint):
        environment = specification(name)[2]
        if needs_setup(environment):
            pending[name] = environment
    if not pending:
        return
    try:
        budget = max(float(os.environ.get("FOUNDRY_IQ_MCP_SETUP_WAIT", MCP_SETUP_WAIT_SECONDS)), 0.0)
    except ValueError as exc:
        raise RuntimeErrorDetail("FOUNDRY_IQ_MCP_SETUP_WAIT must be a number of seconds.") from exc
    deadline = time.monotonic() + budget
    children = {}
    for name, environment in pending.items():
        environment.parent.mkdir(parents=True, exist_ok=True)
        log = environment.parent / f"setup-{environment.name[:16]}.log"
        if setup_active(environment):
            children[name] = (None, log)
            continue
        with log.open("wb") as stream:
            children[name] = (spawn_setup(name, stream), log)
    while True:
        waiting = []
        for name, (process, log) in children.items():
            environment = pending[name]
            if (environment / "ready.json").is_file():
                continue
            code = None if process is None else process.poll()
            if code is not None and not setup_active(environment) and not (environment / "ready.json").is_file():
                detail = log.read_text(encoding="utf-8", errors="replace")[-4000:].strip()
                raise RuntimeErrorDetail(f"Background {name} runtime setup failed (exit {code}); log: {log}\n{detail}")
            waiting.append(name)
        if not waiting:
            return
        if time.monotonic() >= deadline:
            logs = "; ".join(f"{name}: {children[name][1]}" for name in waiting)
            raise SetupPending(
                f"Setup logs: {logs}\n"
                f"First use after install or upgrade: still preparing the {', '.join(waiting)} Python runtime in the "
                "background (this continues after this launch exits). Reconnect this MCP server or restart the "
                "session in a few minutes."
            )
        time.sleep(0.25)


def prepare_apps(entrypoint: str) -> None:
    """Bridge the pinned SDK's discovery probe to a later legacy handshake."""
    from mcp.server import runner

    async def serve_modern_stream(server, read_stream, write_stream, *, lifespan_state, raise_exceptions):
        dispatcher = runner.JSONRPCDispatcher(
            read_stream, write_stream, raise_handler_exceptions=raise_exceptions,
        )
        outbound = runner.NotifyOnlyOutbound(dispatcher)
        legacy_runner = None

        async def on_request(dctx, method, params):
            nonlocal legacy_runner
            if method == "initialize" or (legacy_runner is not None and not runner._has_modern_envelope(params)):
                if legacy_runner is None:
                    legacy_runner = runner.ServerRunner(
                        server, runner.Connection.for_loop(dispatcher, session_id=None), lifespan_state,
                    )
                return await legacy_runner.on_request(dctx, method, params)
            route = runner.classify_inbound_request({"method": method, "params": params})
            if isinstance(route, runner.InboundLadderRejection):
                raise runner.MCPError(code=route.code, message=route.message, data=route.data)
            connection = runner.Connection.from_envelope(
                route.protocol_version, route.client_info, route.client_capabilities, outbound=outbound,
            )
            try:
                return await runner.serve_one(
                    server, runner._NoServerRequestsDispatchContext(dctx), method, params,
                    connection=connection, lifespan_state=lifespan_state,
                )
            except (runner.MCPError, runner.ValidationError):
                raise
            except Exception as exc:
                if raise_exceptions:
                    raise
                error = runner.modern_error_data(exc)
                raise runner.MCPError(code=error.code, message=error.message, data=error.data) from exc

        async def on_notify(dctx, method, params):
            if legacy_runner is not None:
                await legacy_runner.on_notify(dctx, method, params)
                return
            connection = runner.Connection.from_envelope(
                runner.LATEST_MODERN_VERSION, None, None, outbound=outbound,
            )
            try:
                await runner.ServerRunner(server, connection, lifespan_state).on_notify(
                    runner._NoServerRequestsDispatchContext(dctx), method, params,
                )
            finally:
                await runner.aclose_shielded(connection)

        try:
            await dispatcher.run(on_request, on_notify)
        finally:
            if legacy_runner is not None:
                await runner.aclose_shielded(legacy_runner.connection)

    runner._serve_modern_stream = serve_modern_stream
    if entrypoint in ("entity-apps", "entity-graph-apps", "foundry-iq-graph"):
        from collections.abc import Mapping
        from adapters.mcp import apps_sdk

        original_load = apps_sdk._load_descriptor

        class LazyDescriptor(Mapping):
            def __init__(self):
                self.descriptor = None

            def resolve(self):
                if self.descriptor is None:
                    self.descriptor = original_load(None)
                return self.descriptor

            def __getitem__(self, key):
                return self.resolve()[key]

            def __iter__(self):
                return iter(self.resolve())

            def __len__(self):
                return len(self.resolve())

            def get(self, key, default=None):
                return self.resolve().get(key, default)

        def load_descriptor(path):
            if path is None and not os.environ.get("ENTITY_DESCRIPTOR"):
                try:
                    return original_load(None)
                except (FileNotFoundError, ValueError):
                    return LazyDescriptor()
            return original_load(path)

        apps_sdk._load_descriptor = load_descriptor


def _entrypoint_domain(token: str) -> str | None:
    try:
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        runtimes = manifest.get("runtimes", {})
    except (OSError, ValueError, AttributeError):
        runtimes = {}
    if token in runtimes:
        return None
    matches = [domain for domain, spec in runtimes.items()
               if isinstance(spec, dict) and token in spec.get("entry_points", {})]
    if len(matches) == 1:
        return matches[0]
    for prefix, domain in (
        (("entity-graph-", "entity-"), "entity"),
        (("topic-graph-", "topicgraph-"), "topicgraph"),
        (("ontology-",), "ontology"),
        (("grounding-",), "grounding"),
    ):
        if token.startswith(prefix) and (not runtimes or domain in runtimes):
            return domain
    return None


def recovery_python() -> str:
    try:
        return f"Python {supported_text()} executable"
    except (OSError, ValueError, KeyError, TypeError, RuntimeErrorDetail):
        return "Python executable of a version this plugin supports"


def main(argv: list[str] | None = None) -> int:
    if os.name == "nt":
        # Keep Windows from running python, py, uv or az from the current folder; children inherit this.
        os.environ.setdefault("NoDefaultCurrentDirectoryInExePath", "1")
    raw_argv = list(sys.argv[1:] if argv is None else argv)
    if raw_argv and raw_argv[0] in {"entity", "topicgraph", "ontology", "grounding"}:
        raw_argv = ["run" if len(raw_argv) > 1 else "status", *raw_argv]
    elif raw_argv and (inferred := _entrypoint_domain(raw_argv[0])):
        raw_argv = ["run", inferred, *raw_argv]
    elif len(raw_argv) >= 2 and raw_argv[0] == "run" and (inferred := _entrypoint_domain(raw_argv[1])):
        raw_argv = ["run", inferred, *raw_argv[1:]]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("setup", "status", "run"))
    parser.add_argument("domain")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(raw_argv)
    if os.name == "nt" and args.action == "run":
        exit_with_launcher()
    selected = Path(sys.executable).resolve()
    try:
        target_id()
        binding = interpreter_binding(args.domain)
        selected = select_python(args.action, binding)
        if selected != Path(sys.executable).resolve():
            verify_python(selected)
            command = [str(selected), "-I", str(ROOT / "bootstrap.py"), *raw_argv]
            # Forward stdio unchanged: MCP stdout must contain only protocol messages.
            if os.name == "nt":
                return run_attached(command)
            os.execve(str(selected), command, os.environ.copy())
        spec, key, environment = specification(args.domain)
        if args.action == "setup":
            if args.command:
                raise RuntimeErrorDetail("Setup accepts only a runtime name.")
            setup(spec, key, environment)
            bind_python(binding)
        else:
            if args.action == "run" and args.command and args.command[0] in MCP_ENTRYPOINTS:
                prepare_for_mcp(args.domain, args.command[0])
            if needs_setup(environment):
                setup(spec, key, environment)
                bind_python(binding)
            verify(spec, key, environment)
            if not binding.exists():
                bind_python(binding)
        if args.action == "run":
            if args.command in (["--help"], ["-h"]):
                available = ", ".join(sorted(spec["entry_points"]))
                print(
                    f"Runtime '{args.domain}' console entry points: {available}\n"
                    f"Usage: python -I \"{ROOT / 'bootstrap.py'}\" run {args.domain} <entrypoint> [args...]"
                )
                return 0
            if not args.command or args.command[0] not in spec["entry_points"]:
                available = ", ".join(sorted(spec["entry_points"]))
                raise RuntimeErrorDetail(
                    f"Select a console entry point declared by this runtime wheel ({available})."
                )
            extra_env = {}
            if args.command[0] in ("foundry-iq-workspace", "graph-playground"):
                extra_env["FOUNDRY_IQ_BOOTSTRAP_PYTHON"] = sys.executable
            if args.command[0] == "foundry-iq-graph":
                manifest = load_manifest()
                if "topicgraph" in manifest.get("runtimes", {}):
                    tg_binding = interpreter_binding("topicgraph")
                    tg_spec, tg_key, tg_env = specification("topicgraph")
                    if needs_setup(tg_env):
                        setup(tg_spec, tg_key, tg_env)
                        bind_python(tg_binding)
                    verify(tg_spec, tg_key, tg_env)
                    if not tg_binding.exists():
                        bind_python(tg_binding)
                    tg_site = tg_env / ("Lib/site-packages" if os.name == "nt" else f"lib/python{running_version()}/site-packages")
                    extra_env["FOUNDRY_IQ_TOPICGRAPH_SITE_PACKAGES"] = str(tg_site)
            code = "import importlib.metadata as m,sys;"
            compatibility_args = []
            if args.command[0] in MCP_ENTRYPOINTS:
                code += "import runpy;runpy.run_path(sys.argv.pop(1))['prepare_apps'](sys.argv.pop(1));"
                compatibility_args = [str(ROOT / "bootstrap.py"), args.command[0]]
            code += (
                "d=m.distribution(sys.argv.pop(1));sys.argv=sys.argv[1:];name=sys.argv[0];"
                "e=next(e for e in d.entry_points if e.group=='console_scripts' and e.name==name);"
                "sys.exit(e.load()())"
            )
            # The distribution is installed locally; no repository imports or PATH lookup.
            if args.command[0] in MCP_ENTRYPOINTS and Path.cwd().resolve().is_relative_to(PLUGIN.resolve()):
                os.chdir(environment)
            command = [
                str(python_path(environment)), "-I", "-B", "-X", "utf8", "-c", code, *compatibility_args,
                spec["wheel"]["name"], *args.command,
            ]
            run_env = {**child_env(environment), **extra_env}
            if os.name == "nt":
                return run_attached(command, run_env)
            os.execve(str(python_path(environment)), command, run_env)
        print(json.dumps({"status": "ready", "runtime": args.domain, "key": key, "python": str(python_path(environment))}))
        return 0
    except SetupPending as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except UnsupportedPlatform as exc:
        print(f"Runtime {args.action} failed: {exc}", file=sys.stderr)
        return 1
    except (RuntimeErrorDetail, OSError, ValueError, KeyError, TypeError) as exc:
        recovery_args = [sys.executable, "-I", str(ROOT / "bootstrap.py"), "setup", args.domain]
        recovery = ("& " + " ".join("'" + item.replace("'", "''") + "'" for item in recovery_args)
                    if os.name == "nt" else shlex.join(recovery_args))
        print(
            f"Runtime {args.action} failed: {exc}\n"
            f"Bootstrap executable: {sys.executable}; version: {sys.version.split()[0]}; selected executable: {selected}.\n"
            f"Recovery: set FOUNDRY_IQ_PYTHON to an existing absolute {recovery_python()}, "
            f"then run explicit setup with the same FOUNDRY_IQ_RUNTIME_CACHE: {recovery}\n"
            "Do not change shared Python defaults; only absent isolated runtimes are auto-prepared, "
            "and corrupt or incomplete environments are never repaired automatically.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
