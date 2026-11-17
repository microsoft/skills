"""Own an MCP stdio process tree using Windows jobs or a POSIX process group."""

import os
import subprocess
import sys
import threading
import time
import signal


def posix_main():
    if len(sys.argv) < 5 or sys.argv[1] != "--stdio":
        raise ValueError("POSIX supervision requires --stdio <parent PID> <absolute executable>.")
    parent_pid = int(sys.argv[2])
    command = sys.argv[3:]
    if not os.path.isabs(command[0]) or os.getppid() != parent_pid:
        raise ValueError("Expected the owning connector and an absolute executable.")
    # No threads exist yet; block termination across spawn until cleanup handlers exist.
    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGINT})
    try:
        child = subprocess.Popen(command, start_new_session=True,
                                 preexec_fn=lambda: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask))
    except BaseException:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        raise
    stopping = threading.Event()
    lock = threading.Lock()

    def group_exists():
        child.poll()
        try:
            os.killpg(child.pid, 0)
            return True
        except ProcessLookupError:
            return False

    def cleanup():
        with lock:
            if stopping.is_set():
                return
            stopping.set()
            if group_exists():
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass  # The group already exited.
                deadline = time.monotonic() + 0.5
                while group_exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                if group_exists():
                    try:
                        os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass  # The group exited before the forced kill.
            child.wait(timeout=0.5)

    class Interrupted(Exception):
        pass

    def interrupted(_signum, _frame):
        raise Interrupted()

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)

    def watch_parent():
        while not stopping.wait(0.05):
            if os.getppid() != parent_pid:
                try:
                    cleanup()
                except Exception:
                    print("POSIX owned process-group cleanup failed.", file=sys.stderr, flush=True)
                    os._exit(126)
                os._exit(125)

    try:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        threading.Thread(target=watch_parent, daemon=True).start()
        while child.poll() is None:
            if stopping.wait(0.02):
                return 125
        code = child.returncode
        while group_exists() and not stopping.wait(0.02):
            pass
        return code
    except Interrupted:
        return 125
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        cleanup()


if os.name != "nt":
    try:
        sys.exit(posix_main())
    except Exception:
        print("POSIX MCP process-group supervision failed.", file=sys.stderr, flush=True)
        sys.exit(126)

import ctypes
import ctypes.wintypes as w
import msvcrt


class BasicLimits(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_longlong),
        ("PerJobUserTimeLimit", ctypes.c_longlong),
        ("LimitFlags", w.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", w.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", w.DWORD),
        ("SchedulingClass", w.DWORD),
    ]


class IoCounters(ctypes.Structure):
    _fields_ = [(name, ctypes.c_ulonglong) for name in (
        "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
        "ReadTransferCount", "WriteTransferCount", "OtherTransferCount",
    )]


class ExtendedLimits(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", BasicLimits), ("IoInfo", IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


class Accounting(ctypes.Structure):
    _fields_ = [(name, ctypes.c_longlong) for name in (
        "TotalUserTime", "TotalKernelTime", "ThisPeriodTotalUserTime", "ThisPeriodTotalKernelTime",
    )] + [(name, w.DWORD) for name in (
        "TotalPageFaultCount", "TotalProcesses", "ActiveProcesses", "TotalTerminatedProcesses",
    )]


class StartupInfo(ctypes.Structure):
    _fields_ = [
        ("cb", w.DWORD), ("lpReserved", w.LPWSTR), ("lpDesktop", w.LPWSTR),
        ("lpTitle", w.LPWSTR), ("dwX", w.DWORD), ("dwY", w.DWORD),
        ("dwXSize", w.DWORD), ("dwYSize", w.DWORD), ("dwXCountChars", w.DWORD),
        ("dwYCountChars", w.DWORD), ("dwFillAttribute", w.DWORD), ("dwFlags", w.DWORD),
        ("wShowWindow", w.WORD), ("cbReserved2", w.WORD), ("lpReserved2", ctypes.POINTER(w.BYTE)),
        ("hStdInput", w.HANDLE), ("hStdOutput", w.HANDLE), ("hStdError", w.HANDLE),
    ]


class ProcessInfo(ctypes.Structure):
    _fields_ = [("hProcess", w.HANDLE), ("hThread", w.HANDLE),
                ("dwProcessId", w.DWORD), ("dwThreadId", w.DWORD)]


class StartupInfoEx(ctypes.Structure):
    _fields_ = [("StartupInfo", StartupInfo), ("lpAttributeList", ctypes.c_void_p)]


kernel = ctypes.WinDLL("kernel32", use_last_error=True)


def api(name, result, *arguments):
    function = getattr(kernel, name)
    function.restype = result
    function.argtypes = arguments
    return function


create_job = api("CreateJobObjectW", w.HANDLE, ctypes.c_void_p, w.LPCWSTR)
set_job = api("SetInformationJobObject", w.BOOL, w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD)
query_job = api("QueryInformationJobObject", w.BOOL, w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD, ctypes.c_void_p)
initialize_attributes = api("InitializeProcThreadAttributeList", w.BOOL, ctypes.c_void_p,
                            w.DWORD, w.DWORD, ctypes.POINTER(ctypes.c_size_t))
update_attribute = api("UpdateProcThreadAttribute", w.BOOL, ctypes.c_void_p, w.DWORD,
                       ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_void_p)
delete_attributes = api("DeleteProcThreadAttributeList", None, ctypes.c_void_p)
create_process = api("CreateProcessW", w.BOOL, w.LPCWSTR, w.LPWSTR, ctypes.c_void_p, ctypes.c_void_p,
                     w.BOOL, w.DWORD, ctypes.c_void_p, w.LPCWSTR, ctypes.POINTER(StartupInfoEx), ctypes.POINTER(ProcessInfo))
resume = api("ResumeThread", w.DWORD, w.HANDLE)
wait = api("WaitForSingleObject", w.DWORD, w.HANDLE, w.DWORD)
exit_code = api("GetExitCodeProcess", w.BOOL, w.HANDLE, ctypes.POINTER(w.DWORD))
close = api("CloseHandle", w.BOOL, w.HANDLE)
exit_process = api("ExitProcess", None, w.UINT)


def check(result):
    if not result:
        raise ctypes.WinError(ctypes.get_last_error())
    return result


def parent_lifetime():
    # EOF means the connector died. Closing this process closes the sole job handle.
    while os.read(sys.stdin.fileno(), 1):
        pass
    os._exit(125)


def main():
    stdio = len(sys.argv) > 3 and sys.argv[1] == "--stdio"
    parent = None
    if stdio:
        parent_pid = int(sys.argv[2])
        parent = check(api("OpenProcess", w.HANDLE, w.DWORD, w.BOOL, w.DWORD)(
            0x100000, False, parent_pid))
        sys.argv = [sys.argv[0], *sys.argv[3:]]
    if len(sys.argv) < 2 or not os.path.isabs(sys.argv[1]):
        raise ValueError("An absolute target executable is required.")
    job = check(create_job(None, None))
    process = ProcessInfo()
    attributes = None
    attributes_initialized = False
    try:
        limits = ExtendedLimits()
        limits.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        check(set_job(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)))
        os.set_handle_inheritable(msvcrt.get_osfhandle(sys.stdin.fileno()), stdio)
        with open(os.devnull, "rb") as null:
            handles = [msvcrt.get_osfhandle(stream.fileno()) for stream in
                       (sys.stdin if stdio else null, sys.stdout, sys.stderr)]
            for handle in handles:
                os.set_handle_inheritable(handle, True)
            size = ctypes.c_size_t()
            ctypes.set_last_error(0)
            if initialize_attributes(None, 2, 0, ctypes.byref(size)) or ctypes.get_last_error() != 122 or not size.value:
                raise RuntimeError("Unable to size process attribute list.")
            attributes = ctypes.create_string_buffer(size.value)
            check(initialize_attributes(attributes, 2, 0, ctypes.byref(size)))
            attributes_initialized = True
            jobs = (w.HANDLE * 1)(job)
            inherited = (w.HANDLE * len(handles))(*handles)
            # Atomic job membership closes the forced-death gap before ResumeThread.
            check(update_attribute(attributes, 0, 0x2000D, jobs, ctypes.sizeof(jobs), None, None))
            check(update_attribute(attributes, 0, 0x20002, inherited, ctypes.sizeof(inherited), None, None))
            startup = StartupInfoEx()
            startup.StartupInfo.cb = ctypes.sizeof(startup)
            startup.StartupInfo.dwFlags = 0x100  # STARTF_USESTDHANDLES
            startup.StartupInfo.hStdInput, startup.StartupInfo.hStdOutput, startup.StartupInfo.hStdError = handles
            startup.lpAttributeList = ctypes.addressof(attributes)
            command = ctypes.create_unicode_buffer(subprocess.list2cmdline(sys.argv[1:]))
            check(create_process(sys.argv[1], command, None, None, True,
                                 0x4 | 0x08000000 | 0x80000, None, None, ctypes.byref(startup), ctypes.byref(process)))
        if resume(process.hThread) == 0xFFFFFFFF:
            raise ctypes.WinError(ctypes.get_last_error())
        def watch_parent():
            if wait(parent, 0xFFFFFFFF) != 0:
                os._exit(126)
            os._exit(125)
        threading.Thread(target=watch_parent if stdio else parent_lifetime, daemon=True).start()
        if wait(process.hProcess, 0xFFFFFFFF) != 0:
            raise ctypes.WinError(ctypes.get_last_error())
        code = w.DWORD()
        check(exit_code(process.hProcess, ctypes.byref(code)))
        # Keep ownership alive after root exit, including descendants holding pipes.
        while True:
            accounting = Accounting()
            check(query_job(job, 1, ctypes.byref(accounting), ctypes.sizeof(accounting), None))
            if accounting.ActiveProcesses == 0:
                break
            time.sleep(0.01)
        return code.value
    finally:
        if attributes_initialized:
            delete_attributes(attributes)
        check(close(job))
        if process.hThread:
            check(close(process.hThread))
        if process.hProcess:
            check(close(process.hProcess))
        if parent:
            check(close(parent))


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        print("CLI Job Object supervision failed.", file=sys.stderr, flush=True)
        code = 126
    # All owned handles are already closed; avoid finalizing a blocked control thread.
    exit_process(code)
