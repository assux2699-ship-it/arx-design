"""Start ARX's independent public site with per-console Windows safety.

Unlike webpanel.py this process never owns Discord, OAuth callbacks,
database mutations or Paddle webhooks.
"""
from __future__ import annotations

import os


def _disable_quick_edit(kernel32) -> bool:
    """Prevent Windows console text selection from suspending our Uvicorn event loop.

    Only changes the current console input mode; never modifies the registry,
    global Windows settings or other already-running console windows.
    """
    import ctypes

    STD_INPUT_HANDLE = -10
    ENABLE_QUICK_EDIT_MODE = 0x0040
    ENABLE_EXTENDED_FLAGS = 0x0080
    # Win64 handles are pointer-sized. ctypes defaults to c_int (32 bit);
    # always declare the correct return and argument types before calling.
    kernel32.GetStdHandle.argtypes = [ctypes.c_long]
    kernel32.GetStdHandle.restype = ctypes.c_void_p
    kernel32.GetConsoleMode.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    kernel32.GetConsoleMode.restype = ctypes.c_int
    kernel32.SetConsoleMode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    kernel32.SetConsoleMode.restype = ctypes.c_int
    handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)
    if handle in (None, 0, ctypes.c_void_p(-1).value):
        return False
    original = ctypes.c_ulong()
    if not kernel32.GetConsoleMode(handle, ctypes.byref(original)):
        return False
    new_mode = (original.value | ENABLE_EXTENDED_FLAGS) & ~ENABLE_QUICK_EDIT_MODE
    if new_mode == original.value:
        return True
    return bool(kernel32.SetConsoleMode(handle, new_mode))


def configure_console() -> bool:
    if os.name != "nt":
        return False
    try:
        import ctypes

        return _disable_quick_edit(ctypes.WinDLL("kernel32", use_last_error=True))
    except (OSError, AttributeError, ValueError):
        # No attached console (service mode) is perfectly valid.
        return False


def main() -> None:
    if configure_console():
        print("[ARX] Website konsolunda QuickEdit devre disi: yanlis secim servisi duraklatamaz.", flush=True)
    import uvicorn

    uvicorn.run("website.app:app", host="127.0.0.1", port=8001, log_level="info")


if __name__ == "__main__":
    main()
