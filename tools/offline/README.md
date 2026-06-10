# Offline Dependency Drop Zone

Place closed-network build dependencies here before running `build_exe_offline.bat`.

Expected layout:

```text
tools/offline/
  node/node.exe
  nuget/Microsoft.Web.WebView2.1.0.2903.40.nupkg
  wheels/*.whl
```

The wheelhouse must include PyInstaller's Windows dependencies, especially:

```text
pyinstaller-*.whl
pyinstaller_hooks_contrib-*.whl
pefile-*.whl
pywin32_ctypes-*.whl
pywin32-*-win_amd64.whl
openpyxl-*.whl
```

Optional:

```text
tools/offline/python/python.exe
```

See `OFFLINE_PORTABLE_BUILD.md` in the repo root for the full procedure.
