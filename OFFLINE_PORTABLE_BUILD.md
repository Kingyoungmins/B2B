# Offline Portable Build

This guide is for Windows build/test PCs that cannot access the internet.

## Goal

Build a portable package without downloading anything during the build:

```text
dist\B2B_ver0.5.9\
dist\B2B_ver0.5.9_portable.zip
```

The portable folder contains:

- `B2B_ver0.5.9.exe` native shell
- `B2B_Server.exe` PyInstaller server
- WebView2 SDK DLLs used by the native shell
- `node.exe` bundled beside the server

## Closed-Network Requirements

The target/test PC still needs:

- Windows x64
- Microsoft Excel desktop app
- WebView2 Runtime installed

If WebView2 Runtime is not already installed, copy the offline installer into the closed network and run it once:

```text
MicrosoftEdgeWebView2RuntimeInstallerX64.exe
```

The WebView2 NuGet package used below is for compiling the native host. It is not the same as the WebView2 Runtime.

## Offline Dependency Layout

Before running `build_exe_offline.bat`, prepare this layout:

```text
tools\
  offline\
    node\
      node.exe
    nuget\
      Microsoft.Web.WebView2.1.0.2903.40.nupkg
    wheels\
      pyinstaller-*.whl
      pyinstaller_hooks_contrib-*.whl
      altgraph-*.whl
      packaging-*.whl
      pefile-*.whl
      pywin32_ctypes-*.whl
      pywin32-*.whl
      openpyxl-*.whl
      et_xmlfile-*.whl
```

Python can be either installed on the build PC or placed here:

```text
tools\offline\python\python.exe
```

Using an installed Python is usually simpler for PyInstaller.

## How To Prepare Dependencies On An Internet PC

Download Windows x64 wheels for the same Python major/minor version as the closed-network build PC. The bundled portable package uses Python 3.12, so force `win_amd64`/`cp312` when preparing wheels from macOS/Linux or from a different Python version.

```bat
mkdir tools\offline\wheels
python -m pip download ^
  --dest tools\offline\wheels ^
  --only-binary=:all: ^
  --platform win_amd64 ^
  --python-version 312 ^
  --implementation cp ^
  --abi cp312 ^
  pyinstaller pyinstaller-hooks-contrib pefile pywin32-ctypes pywin32 openpyxl et_xmlfile packaging altgraph
```

If the closed-network build fails with:

```text
No matching distribution found for pefile>=2022.5.30; sys_platform == "win32"
```

the wheelhouse is missing PyInstaller's Windows-only `pefile` dependency. Add
`pefile-*.whl` to `tools\offline\wheels` and run `build_exe_offline.bat` again.

If it fails with:

```text
No matching distribution found for pywin32-ctypes>=0.2.1; sys_platform == "win32"
```

the wheelhouse is missing another PyInstaller Windows-only dependency. Add
`pywin32_ctypes-*.whl` to `tools\offline\wheels` and run the build again.

Download the WebView2 NuGet package:

```text
https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40
```

Save it as:

```text
tools\offline\nuget\Microsoft.Web.WebView2.1.0.2903.40.nupkg
```

Download Windows x64 Node.js, unzip it, and copy:

```text
node.exe -> tools\offline\node\node.exe
```

Then copy the repo plus `tools\offline\...` into the closed network.

## Build In Closed Network

From the repo root:

```bat
build_exe_offline.bat
```

Run the packaged app:

```bat
dist\B2B_ver0.5.9\B2B_ver0.5.9.exe
```

Or move this zip to the test PC:

```text
dist\B2B_ver0.5.9_portable.zip
```

## Notes

- `build_exe_offline.bat` sets `B2B_OFFLINE_BUILD=1`, so the native host build fails instead of downloading WebView2 when the local `.nupkg` is missing.
- The script prepends `tools\offline\node` to `PATH`, so PyInstaller bundles that `node.exe`.
- The generated package also copies `node.exe` beside `B2B_Server.exe`; the backend checks that location first at runtime.
- No commit is required for this test branch; the build uses the current working tree.
