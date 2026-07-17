using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace B2BNativeHost
{
    static class Program
    {
        public static readonly string LogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "native_host.log");

        public static void Log(string message)
        {
            try
            {
                File.AppendAllText(
                    LogPath,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + message + Environment.NewLine,
                    Encoding.UTF8
                );
            }
            catch
            {
            }
        }

        private static void ShowFatal(Exception ex)
        {
            Log("FATAL " + ex);
            try
            {
                MessageBox.Show(ex.ToString(), "Native host fatal error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            catch
            {
            }
        }

        [STAThread]
        static void Main()
        {
            // [0.5.16] 단일 인스턴스 가드 — 두 번 켜지면(또는 이전 게 덜 닫혔으면) 백엔드가 둘 떠서, 한쪽을
            // 닫아도 다른 인스턴스의 Excel 이 orphan 으로 남는다("종료해도 Excel 이 안 죽음"의 원인). 이미 실행
            // 중이면 두 번째는 띄우지 않는다.
            bool createdNew;
            using (System.Threading.Mutex instanceMutex = new System.Threading.Mutex(true, "B2B_NativeHost_SingleInstance_v1", out createdNew))
            {
                if (!createdNew)
                {
                    try { MessageBox.Show("B2B 빌링 Agent 가 이미 실행 중입니다.\n기존 창을 사용해 주세요.", "B2B", MessageBoxButtons.OK, MessageBoxIcon.Information); }
                    catch { }
                    return;
                }
                Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e) { ShowFatal(e.Exception); };
                AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
                {
                    Exception ex = e.ExceptionObject as Exception;
                    ShowFatal(ex ?? new Exception(Convert.ToString(e.ExceptionObject)));
                };
                try
                {
                    Log("Native host starting");
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    Application.Run(new MainForm());
                    Log("Native host stopped");
                }
                catch (Exception ex)
                {
                    ShowFatal(ex);
                }
            }
        }
    }

    public class MainForm : Form
    {
        private readonly string rootDir;
        private readonly SplitContainer split;
        private readonly WebView2 webView;
        private readonly TableLayoutPanel rightLayout;
        private readonly FlowLayoutPanel nativeFileTabs;
        private readonly Panel excelPanel;
        private readonly Label excelLoadingLabel;
        private readonly Label startupSplash;
        private Process serverProcess;
        private int port;
        private string appUrl;
        private bool webReady;
        private string lastNativeBoundsKey = "";
        private string webViewUserDataDir = "";
        private const int NativeFastTimerIntervalMs = 80;
        private const int ExcelFocusIdleTimerIntervalMs = 500;
        private const int VbaDebugIdleTimerIntervalMs = 1000;
        private System.Windows.Forms.Timer excelFocusTimer;
        private System.Windows.Forms.Timer vbaDebugSuppressTimer;
        private DateTime vbaDebugFastUntilUtc = DateTime.MinValue;
        private bool excelMouseDownFocused;
        private FormWindowState lastWindowState;
        private volatile bool hostMinimized;
        private bool shuttingDown;
        private bool restartingServer;
        private string lastDownloadDir = "";
        private DateTime lastServerRestartUtc = DateTime.MinValue;
        private int recentRestartCount;
        private bool debugHotkeyRegistered;
        private const int DEBUG_HOTKEY_ID = 0xB2B8;
        private const int WM_HOTKEY = 0x0312;
        private const int WM_CLOSE = 0x0010;
        private const int SW_HIDE = 0;

        private delegate bool EnumWindowProc(IntPtr hwnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumChildWindows(IntPtr hwndParent, EnumWindowProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        private static extern bool EnableWindow(IntPtr hWnd, bool bEnable);

        [DllImport("user32.dll")]
        private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

        private const uint GW_OWNER = 4;
        private const int WM_SYSCOMMAND = 0x0112;
        private const int SC_MINIMIZE = 0xF020;

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        public MainForm()
        {
            rootDir = FindRootDir();
            Text = "B2B 빌링 Agent";
            StartPosition = FormStartPosition.CenterScreen;
            KeyPreview = true;
            // 최대화 시 작업영역(작업표시줄 제외)으로 제한 → 작업표시줄을 덮지 않음.
            MaximizedBounds = Screen.PrimaryScreen.WorkingArea;
            WindowState = FormWindowState.Maximized;
            // 창 크기 조절 부담을 없앤다: 최대화로 고정하고 최소화만 허용(복원/리사이즈는 HandleHostResize 에서 되돌림).
            MaximizeBox = false;
            MinimizeBox = true;
            MinimumSize = new Size(1280, 760);

            split = new SplitContainer();
            split.Dock = DockStyle.Fill;
            split.Orientation = Orientation.Vertical;
            split.SplitterWidth = 8;
            Controls.Add(split);

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            split.Panel1.Controls.Add(webView);

            // 초기 실행 스플래시: 서버 부팅+WebView 로드까지 빈 화면 대신 안내를 보여준다(저사양 PC 첫 실행 10~20초).
            startupSplash = new Label();
            startupSplash.Dock = DockStyle.Fill;
            startupSplash.Text = "B2B 빌링 Agent 준비 중입니다...\n\n처음 실행은 컴퓨터 성능에 따라 10~20초 정도 걸릴 수 있습니다.";
            startupSplash.TextAlign = ContentAlignment.MiddleCenter;
            startupSplash.Font = new Font(Font.FontFamily, 12F, FontStyle.Bold);
            startupSplash.ForeColor = Color.FromArgb(80, 80, 96);
            startupSplash.BackColor = Color.FromArgb(248, 249, 252);
            split.Panel1.Controls.Add(startupSplash);
            startupSplash.BringToFront();

            rightLayout = new TableLayoutPanel();
            rightLayout.Dock = DockStyle.Fill;
            rightLayout.ColumnCount = 1;
            rightLayout.RowCount = 2;
            rightLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            rightLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58F));
            rightLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            rightLayout.Margin = Padding.Empty;
            rightLayout.Padding = Padding.Empty;
            split.Panel2.Controls.Add(rightLayout);

            nativeFileTabs = new FlowLayoutPanel();
            nativeFileTabs.Dock = DockStyle.Fill;
            nativeFileTabs.Padding = new Padding(8, 7, 8, 18);
            nativeFileTabs.BackColor = Color.White;
            nativeFileTabs.WrapContents = false;
            nativeFileTabs.AutoScroll = true;
            nativeFileTabs.FlowDirection = FlowDirection.LeftToRight;
            rightLayout.Controls.Add(nativeFileTabs, 0, 0);

            excelPanel = new Panel();
            excelPanel.Dock = DockStyle.Fill;
            excelPanel.BackColor = Color.White;
            rightLayout.Controls.Add(excelPanel, 0, 1);

            excelLoadingLabel = new Label();
            excelLoadingLabel.Dock = DockStyle.Fill;
            excelLoadingLabel.Text = "Excel 여는 중...";
            excelLoadingLabel.TextAlign = ContentAlignment.MiddleCenter;
            excelLoadingLabel.Font = new Font(Font.FontFamily, 11F, FontStyle.Bold);
            excelLoadingLabel.ForeColor = Color.FromArgb(96, 96, 112);
            excelLoadingLabel.BackColor = Color.FromArgb(248, 249, 252);
            excelLoadingLabel.Visible = false;
            excelPanel.Controls.Add(excelLoadingLabel);

            excelPanel.MouseDown += (s, e) => FocusExcelChild();
            excelPanel.Enter += (s, e) => FocusExcelChild();
            StartExcelFocusAssist();
            StartVbaDebugSuppressor();

            Load += async (s, e) => await InitializeAsync();
            Shown += (s, e) => ApplyInitialSplitterLayout();
            FormClosing += (s, e) => Cleanup();
            Resize += (s, e) => HandleHostResize();
            Move += (s, e) => PublishNativeBounds();
            Activated += (s, e) =>
            {
                PublishNativeBounds();
                // 호스트 창(웹뷰 + 네이티브 탭 포함)이 활성화됨 → JS에 알림.
                // 여기서 즉시 Excel 을 복원하면 비활성 WebView 의 첫 버튼 클릭이 포커스/raise 처리에
                // 소비될 수 있어, 실제 복원은 JS 의 지연 스케줄이나 최소화 복원 경로에서만 수행한다.
                ExecuteWebScript("window.dispatchEvent(new Event('b2bHostActivated'));");
                RestoreActiveExcelMirror(false);
                // WebView2 는 비활성→활성 전환의 첫 클릭을 페이지에 전달하지 않는 경우가 있다.
                // 활성화 직후 웹뷰에 포커스를 미리 줘서 다음 클릭부터 바로 UI 버튼에 닿게 한다.
                try
                {
                    BeginInvoke(new Action(delegate
                    {
                        try { if (webReady && webView != null) webView.Focus(); } catch { }
                    }));
                }
                catch
                {
                }
            };
            Deactivate += (s, e) =>
            {
                // 호스트 창이 비활성화됨(엑셀/다른 앱/최소화). 포그라운드 판정은 python(hide-inactive)이 수행.
                ExecuteWebScript("window.dispatchEvent(new Event('b2bHostDeactivated'));");
            };
            split.SplitterMoved += (s, e) => PublishNativeBounds();
            excelPanel.Resize += (s, e) => PublishNativeBounds();
            lastWindowState = WindowState;
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            RegisterDebugHotkey();  // F8 속도 디버그 패널(병목 진단) — 전역 핫키
        }

        protected override void OnHandleDestroyed(EventArgs e)
        {
            UnregisterDebugHotkey();
            base.OnHandleDestroyed(e);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F8)
            {
                ToggleDebugPanel();  // 호스트/웹뷰 포커스 상태에서도 F8 토글
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private void RegisterDebugHotkey()
        {
            if (debugHotkeyRegistered || Handle == IntPtr.Zero) return;
            try
            {
                debugHotkeyRegistered = RegisterHotKey(Handle, DEBUG_HOTKEY_ID, 0, (uint)Keys.F8);
                if (!debugHotkeyRegistered) Program.Log("F8 debug hotkey registration failed");
            }
            catch (Exception ex)
            {
                Program.Log("F8 debug hotkey registration failed: " + ex.Message);
            }
        }

        private void UnregisterDebugHotkey()
        {
            if (!debugHotkeyRegistered || Handle == IntPtr.Zero) return;
            try
            {
                UnregisterHotKey(Handle, DEBUG_HOTKEY_ID);
            }
            catch
            {
            }
            debugHotkeyRegistered = false;
        }

        private void ToggleDebugPanel()
        {
            ExecuteWebScript("if (typeof toggleDebugPanel === 'function') toggleDebugPanel();");
        }

        private void StartVbaDebugSuppressor()
        {
            if (vbaDebugSuppressTimer != null) return;
            vbaDebugSuppressTimer = new System.Windows.Forms.Timer();
            vbaDebugSuppressTimer.Interval = VbaDebugIdleTimerIntervalMs;
            vbaDebugSuppressTimer.Tick += (s, e) =>
            {
                bool fast = uiBusyActive || DateTime.UtcNow <= vbaDebugFastUntilUtc;
                int wanted = fast ? NativeFastTimerIntervalMs : VbaDebugIdleTimerIntervalMs;
                if (vbaDebugSuppressTimer.Interval != wanted) vbaDebugSuppressTimer.Interval = wanted;
                if (!fast && hostMinimized) return;
                SuppressVbaDebugWindows();
            };
            vbaDebugSuppressTimer.Start();
        }

        private static string WindowText(IntPtr hwnd)
        {
            StringBuilder sb = new StringBuilder(512);
            try { GetWindowText(hwnd, sb, sb.Capacity); } catch { }
            return sb.ToString();
        }

        private void SuppressVbaDebugWindows()
        {
            try
            {
                EnumWindows(delegate(IntPtr hwnd, IntPtr lParam)
                {
                    string title = WindowText(hwnd);
                    string cls = WindowClass(hwnd);
                    string probe = ((title ?? "") + " " + (cls ?? "")).ToLowerInvariant();
                    bool isVbe = probe.Contains("visual basic for applications") ||
                        probe.Contains("microsoft visual basic") ||
                        probe.Contains("wndclass_desked");
                    if (!isVbe) return true;

                    try
                    {
                        if (String.Equals(cls, "#32770", StringComparison.OrdinalIgnoreCase))
                        {
                            PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                        }
                        else
                        {
                            ShowWindow(hwnd, SW_HIDE);
                        }
                    }
                    catch
                    {
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch
            {
            }
        }

        private void ApplyInitialSplitterLayout()
        {
            try
            {
                int width = split.ClientSize.Width;
                if (width < 900) return;
                int distance = Math.Max(520, Math.Min(860, (int)(width * 0.42)));
                if (distance > 0 && distance < width - 320)
                {
                    split.SplitterDistance = distance;
                }
                split.Panel1MinSize = Math.Min(520, Math.Max(0, split.SplitterDistance));
                split.Panel2MinSize = Math.Min(320, Math.Max(0, width - split.SplitterDistance - split.SplitterWidth));
            }
            catch
            {
            }
        }

        private static string FindRootDir()
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            for (int i = 0; i < 5; i++)
            {
                string candidate = Path.GetFullPath(dir);
                if (File.Exists(Path.Combine(candidate, "B2B_Server.exe"))) return candidate;
                if (File.Exists(Path.Combine(candidate, "serve_b2b.py"))) return candidate;
                dir = Path.Combine(candidate, "..");
            }
            return Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", ".."));
        }

        private async Task InitializeAsync()
        {
            try
            {
                port = FindAvailablePort();
                Program.Log("Selected port " + port);
                StartPythonServer();
                appUrl = "http://127.0.0.1:" + port + "/index.html?nativeShell=1";
                Program.Log("Waiting for server " + appUrl);
                await WaitForServerAsync(appUrl, TimeSpan.FromSeconds(20));

                Program.Log("Initializing WebView2");
                CoreWebView2Environment env = await CreateWebViewEnvironmentAsync();
                await webView.EnsureCoreWebView2Async(env);
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled =
                    String.Equals(Environment.GetEnvironmentVariable("B2B_NATIVE_DEVTOOLS"), "1", StringComparison.Ordinal);
                webView.CoreWebView2.ProcessFailed += delegate(object sender, CoreWebView2ProcessFailedEventArgs e)
                {
                    Program.Log("WebView2 process failed kind=" + e.ProcessFailedKind);
                };
                webView.CoreWebView2.WindowCloseRequested += delegate
                {
                    Close();
                };
                webView.CoreWebView2.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs e)
                {
                    try
                    {
                        HandleWebMessage(e.TryGetWebMessageAsString());
                    }
                    catch (Exception ex)
                    {
                        Program.Log("Web message failed: " + ex.Message);
                    }
                };
                webView.CoreWebView2.DownloadStarting += HandleDownloadStarting;
                webView.CoreWebView2.NavigationCompleted += delegate
                {
                    webReady = true;
                    if (startupSplash != null) startupSplash.Visible = false;  // 준비 완료 → 스플래시 숨김
                    // [필드] 초기화(location.reload)·재네비게이션 시 JS 의 window.__B2B_NATIVE_SHELL 이
                    // 사라지는데, 패널 위치가 그대로면 lastNativeBoundsKey 가 같아 재주입을 건너뛰어
                    // 미러 좌표가 복원되지 않았다(초기화 후 Excel 미러 안 보임). 네비게이션마다 강제 재주입.
                    lastNativeBoundsKey = "";
                    PublishNativeBounds();
                };
                webView.CoreWebView2.Navigate(appUrl);
                Program.Log("Navigated " + appUrl);
            }
            catch (Exception ex)
            {
                Program.Log("Initialize failed " + ex);
                MessageBox.Show(this, ex.ToString(), "Native host start failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private async Task<CoreWebView2Environment> CreateWebViewEnvironmentAsync()
        {
            string baseDir = Path.Combine(Path.GetTempPath(), "B2B_WebView2");
            try
            {
                Directory.CreateDirectory(baseDir);
                // [디스크 누수 수정] verNNN_<pid> 폴더 중 '죽은 pid'(지금 안 도는 프로세스)의 것은 즉시 삭제한다.
                // 예전엔 2일 임계라, 매일 여러 번 실행/크래시·강제종료로 2일 안 된 폴더가 수백 MB 쌓였다(WebView2
                // 캐시). 현재 프로세스 폴더는 아래에서 생성되므로 이 목록에 없고, 살아있는 다른 인스턴스 폴더는
                // pid 검사로 보존(잠겨 있으면 Delete 가 실패해 한 번 더 보호된다).
                // [수정] 예전엔 'ver044_' 만 잡아 구버전 폴더(ver043_ 등)가 영영 안 지워졌다 → 'ver*_*' 로 넓히고
                // pid 는 마지막 '_' 뒤 세그먼트로 파싱(마커 길이 무관). 죽은 pid 검사라 버전 무관하게 안전.
                foreach (string dir in Directory.GetDirectories(baseDir, "ver*_*"))
                {
                    try
                    {
                        bool dead = true;
                        string nm = Path.GetFileName(dir);
                        int us = nm.LastIndexOf('_');
                        int pid;
                        if (us >= 0 && us + 1 < nm.Length && Int32.TryParse(nm.Substring(us + 1), out pid))
                        {
                            try { using (Process.GetProcessById(pid)) { dead = false; } }
                            catch { dead = true; }
                        }
                        if (dead)
                        {
                            new DirectoryInfo(dir).Delete(true);
                        }
                    }
                    catch
                    {
                    }
                }
            }
            catch
            {
            }
            webViewUserDataDir = Path.Combine(baseDir, "ver044_" + Process.GetCurrentProcess().Id);
            Directory.CreateDirectory(webViewUserDataDir);
            CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions();
            // Native desktop shell: allow direct calls from local WebView content to the internal Violet/vLLM host.
            // Without this, WebView2 still applies browser CORS rules and the app would need the local /v1 proxy.
            options.AdditionalBrowserArguments = "--disable-web-security --disable-features=BlockInsecurePrivateNetworkRequests";
            return await CoreWebView2Environment.CreateAsync(null, webViewUserDataDir, options);
        }

        // [리뷰⑦] JS 의 beginUiBusy/endUiBusy 가 보내는 B2B_UI_BUSY 의 네이티브 절반:
        // busy 동안 우리 미러 영역과 겹치는 Excel(XLMAIN) 창의 입력을 막아, 적용 중 사용자가
        // 라이브 워크북을 직접 편집해 COM 작업과 경합하는 것을 차단한다.
        // 페이지 리로드(초기화)로 busy=0 이 영영 안 올 수 있으므로 90초 failsafe 타이머로 자동 해제.
        private System.Collections.Generic.List<IntPtr> uiBusyDisabledWindows = new System.Collections.Generic.List<IntPtr>();
        private System.Windows.Forms.Timer uiBusyFailsafeTimer;
        private volatile bool uiBusyActive;

        private void UpdateUiBusyLock(string message)
        {
            string[] parts = message.Split('	');
            bool active = parts.Length > 1 && parts[1] == "1";
            uiBusyActive = active;
            if (active)
            {
                vbaDebugFastUntilUtc = DateTime.UtcNow.AddSeconds(120);
                try { if (vbaDebugSuppressTimer != null) vbaDebugSuppressTimer.Interval = NativeFastTimerIntervalMs; } catch { }
            }
            // [필드#2] busy 동안 네이티브 파일 탭(웹뷰 밖 C# 컨트롤)도 클릭 불가로 — DOM 오버레이가
            // 못 막는 영역. Excel 창 입력 차단(EnableWindow)과 함께 작업 중 끼어들기를 완성한다.
            try { if (nativeFileTabs != null) nativeFileTabs.Enabled = !active; } catch { }
            if (active) ApplyUiBusyLock();
            else ReleaseUiBusyLock();
        }

        private void ApplyUiBusyLock()
        {
            ReleaseUiBusyLock();
            try
            {
                Rectangle panelRect = excelPanel.RectangleToScreen(excelPanel.ClientRectangle);
                EnumWindows(delegate(IntPtr hwnd, IntPtr lParam)
                {
                    try
                    {
                        if (!IsWindowVisible(hwnd)) return true;
                        StringBuilder cls = new StringBuilder(64);
                        GetClassName(hwnd, cls, cls.Capacity);
                        if (cls.ToString().IndexOf("XLMAIN", StringComparison.OrdinalIgnoreCase) < 0) return true;
                        RECT r;
                        if (!GetWindowRect(hwnd, out r)) return true;
                        Rectangle wr = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
                        if (!wr.IntersectsWith(panelRect)) return true; // 우리 오버레이 영역의 Excel 창만(무관한 Excel 보호)
                        EnableWindow(hwnd, false);
                        uiBusyDisabledWindows.Add(hwnd);
                    }
                    catch { }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            if (uiBusyFailsafeTimer == null)
            {
                uiBusyFailsafeTimer = new System.Windows.Forms.Timer();
                uiBusyFailsafeTimer.Interval = 90000;
                uiBusyFailsafeTimer.Tick += delegate { ReleaseUiBusyLock(); };
            }
            uiBusyFailsafeTimer.Stop();
            uiBusyFailsafeTimer.Start();
        }

        private void ReleaseUiBusyLock()
        {
            try { if (nativeFileTabs != null) nativeFileTabs.Enabled = true; } catch { }
            try { if (uiBusyFailsafeTimer != null) uiBusyFailsafeTimer.Stop(); } catch { }
            foreach (IntPtr hwnd in uiBusyDisabledWindows)
            {
                try { EnableWindow(hwnd, true); } catch { }
            }
            uiBusyDisabledWindows.Clear();
        }

        private void HandleWebMessage(string message)
        {
            if (String.IsNullOrEmpty(message)) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(HandleWebMessage), message);
                return;
            }
            if (message.StartsWith("B2B_FILE_TABS\t", StringComparison.Ordinal))
            {
                UpdateNativeFileTabs(message);
                return;
            }
            if (message.StartsWith("B2B_EXCEL_LOADING\t", StringComparison.Ordinal))
            {
                UpdateExcelLoading(message);
                return;
            }
            if (message.StartsWith("B2B_UI_BUSY	", StringComparison.Ordinal))
            {
                UpdateUiBusyLock(message);
                return;
            }
            if (message.StartsWith("B2B_RUNNER_MODE\t", StringComparison.Ordinal))
            {
                SetRunnerMode(message);
                return;
            }
            if (message == "B2B_RESTART_SERVER")
            {
                Task ignore = RestartPythonServerAsync(false);
                return;
            }
        }

        // [0.5.16 #1] 실행기(runner)는 헤드리스 — 우측 패널(파일탭+Excel 영역)을 접어 WebView 가 창을 꽉 채운다.
        // 생성기로 돌아오면 다시 펼치고 미러 좌표를 재발행한다. (Excel 오버레이 자체는 웹이 hideAll 로 숨김)
        private bool runnerModeActive;
        private void SetRunnerMode(string message)
        {
            string[] parts = message.Split('\t');
            bool runner = parts.Length > 1 && parts[1] == "1";
            if (runner == runnerModeActive) return;
            runnerModeActive = runner;
            try { if (split != null) split.Panel2Collapsed = runner; } catch { }
            if (!runner)
            {
                // 펼친 직후 미러 좌표 재발행(접혀 있는 동안 bounds 가 안 바뀌어 재주입 생략되는 것 방지).
                lastNativeBoundsKey = "";
                try { PublishNativeBounds(); } catch { }
            }
        }

        private void HandleDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            try
            {
                string defaultPath = e.ResultFilePath ?? "";
                string defaultName = Path.GetFileName(defaultPath);
                if (String.IsNullOrWhiteSpace(defaultName)) defaultName = "download";

                using (SaveFileDialog dialog = new SaveFileDialog())
                {
                    dialog.Title = "다운로드 저장";
                    dialog.FileName = SafeDownloadFileName(defaultName);
                    dialog.Filter = DownloadFilterForFile(defaultName);
                    dialog.OverwritePrompt = true;
                    dialog.AddExtension = true;

                    string initialDir = "";
                    try
                    {
                        if (!String.IsNullOrWhiteSpace(lastDownloadDir) && Directory.Exists(lastDownloadDir))
                        {
                            initialDir = lastDownloadDir;
                        }
                        else
                        {
                            string defaultDir = Path.GetDirectoryName(defaultPath);
                            if (!String.IsNullOrWhiteSpace(defaultDir) && Directory.Exists(defaultDir))
                            {
                                initialDir = defaultDir;
                            }
                        }
                    }
                    catch
                    {
                    }
                    if (String.IsNullOrWhiteSpace(initialDir))
                    {
                        string downloads = Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                            "Downloads"
                        );
                        initialDir = Directory.Exists(downloads)
                            ? downloads
                            : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                    }
                    if (!String.IsNullOrWhiteSpace(initialDir)) dialog.InitialDirectory = initialDir;

                    DialogResult result = dialog.ShowDialog(this);
                    e.Handled = true;
                    if (result == DialogResult.OK && !String.IsNullOrWhiteSpace(dialog.FileName))
                    {
                        e.ResultFilePath = dialog.FileName;
                        lastDownloadDir = Path.GetDirectoryName(dialog.FileName) ?? "";
                        AttachDownloadCompletionToast(e.DownloadOperation, dialog.FileName);
                        Program.Log("Download save path selected: " + dialog.FileName);
                    }
                    else
                    {
                        e.Cancel = true;
                        Program.Log("Download canceled by user");
                    }
                }
            }
            catch (Exception ex)
            {
                Program.Log("Download dialog failed: " + ex.Message);
            }
        }

        private void AttachDownloadCompletionToast(CoreWebView2DownloadOperation operation, string path)
        {
            if (operation == null) return;
            string name = Path.GetFileName(path);
            if (String.IsNullOrWhiteSpace(name)) name = "파일";
            bool notified = false;
            operation.StateChanged += delegate
            {
                if (notified) return;
                try
                {
                    if (operation.State == CoreWebView2DownloadState.Completed)
                    {
                        notified = true;
                        Program.Log("Download completed: " + path);
                        NotifyWebToast("\"" + name + "\" 다운로드 완료", "success");
                    }
                    else if (operation.State == CoreWebView2DownloadState.Interrupted)
                    {
                        notified = true;
                        string reason = "";
                        try { reason = Convert.ToString(operation.InterruptReason); } catch { }
                        Program.Log("Download interrupted: " + path + " " + reason);
                        NotifyWebToast("\"" + name + "\" 다운로드 실패" + (String.IsNullOrWhiteSpace(reason) ? "" : ": " + reason), "error");
                    }
                }
                catch (Exception ex)
                {
                    Program.Log("Download completion notify failed: " + ex.Message);
                }
            };
        }

        private void NotifyWebToast(string message, string type)
        {
            try
            {
                if (InvokeRequired)
                {
                    BeginInvoke(new Action<string, string>(NotifyWebToast), message, type);
                    return;
                }
                if (!webReady || webView.CoreWebView2 == null) return;
                string script = "if (typeof toast === 'function') toast(" + JsString(message) + "," + JsString(type) + ");";
                webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                Program.Log("NotifyWebToast failed: " + ex.Message);
            }
        }

        private static string SafeDownloadFileName(string name)
        {
            string safe = String.IsNullOrWhiteSpace(name) ? "download" : name.Trim();
            foreach (char ch in Path.GetInvalidFileNameChars())
            {
                safe = safe.Replace(ch, '_');
            }
            return String.IsNullOrWhiteSpace(safe) ? "download" : safe;
        }

        private static string DownloadFilterForFile(string name)
        {
            string ext = Path.GetExtension(name ?? "").ToLowerInvariant();
            if (ext == ".zip") return "ZIP 파일 (*.zip)|*.zip|모든 파일 (*.*)|*.*";
            if (ext == ".xlsx" || ext == ".xlsm" || ext == ".xls")
            {
                return "Excel 파일 (*.xlsx;*.xlsm;*.xls)|*.xlsx;*.xlsm;*.xls|모든 파일 (*.*)|*.*";
            }
            if (ext == ".csv") return "CSV 파일 (*.csv)|*.csv|모든 파일 (*.*)|*.*";
            if (ext == ".json") return "JSON 파일 (*.json)|*.json|모든 파일 (*.*)|*.*";
            return "모든 파일 (*.*)|*.*";
        }

        private void UpdateExcelLoading(string message)
        {
            string[] parts = message.Split('\t');
            bool active = parts.Length > 1 && parts[1] == "1";
            string text = parts.Length > 2 ? DecodeMessagePart(parts[2]) : "";
            excelLoadingLabel.Text = String.IsNullOrWhiteSpace(text) ? "Excel 여는 중..." : text;
            excelLoadingLabel.Visible = active;
            if (active)
            {
                excelLoadingLabel.BringToFront();
            }
        }

        private void UpdateNativeFileTabs(string message)
        {
            string[] parts = message.Split('\t');
            string currentId = parts.Length > 1 ? DecodeMessagePart(parts[1]) : "";
            nativeFileTabs.SuspendLayout();
            try
            {
                nativeFileTabs.Controls.Clear();
                if (parts.Length <= 2)
                {
                    Label empty = new Label();
                    empty.Text = "파일을 업로드하면 여기에 탭이 표시됩니다";
                    empty.AutoSize = true;
                    empty.ForeColor = Color.FromArgb(120, 120, 132);
                    empty.Margin = new Padding(6, 6, 0, 0);
                    nativeFileTabs.Controls.Add(empty);
                    return;
                }
                // [0.5.7] 파일 탭 '더블클릭 전환' 안내 배지. native shell 은 웹의 .right(파일 탭 포함)를
                // 숨기고 우측 탭을 여기 C# nativeFileTabs 로 그리므로, 안내도 웹이 아닌 여기에 직접 넣는다.
                Label hint = new Label();
                hint.Text = "📑 더블클릭으로 전환";
                hint.AutoSize = true;
                hint.ForeColor = Color.FromArgb(209, 0, 160);
                hint.BackColor = Color.FromArgb(255, 241, 250);
                hint.BorderStyle = BorderStyle.FixedSingle;
                hint.Padding = new Padding(6, 4, 6, 4);
                hint.Margin = new Padding(0, 1, 8, 0);
                hint.TextAlign = ContentAlignment.MiddleCenter;
                nativeFileTabs.Controls.Add(hint);
                for (int i = 2; i < parts.Length; i++)
                {
                    if (String.IsNullOrEmpty(parts[i])) continue;
                    string[] fields = parts[i].Split('|');
                    if (fields.Length < 3) continue;
                    string fileId = DecodeMessagePart(fields[0]);
                    string role = DecodeMessagePart(fields[1]);
                    string name = DecodeMessagePart(fields[2]);
                    if (String.IsNullOrWhiteSpace(name))
                    {
                        name = (String.Equals(role, "output", StringComparison.OrdinalIgnoreCase) ? "출력 파일 " : "입력 파일 ") + (i - 1).ToString();
                    }
                    Button btn = new Button();
                    btn.Text = (String.Equals(role, "output", StringComparison.OrdinalIgnoreCase) ? "출력 " : "입력 ") + name;
                    btn.Tag = fileId;
                    btn.Height = 28;
                    btn.Width = Math.Max(128, Math.Min(320, TextRenderer.MeasureText(btn.Text, Font).Width + 34));
                    btn.Margin = new Padding(0, 0, 6, 0);
                    btn.AutoEllipsis = true;
                    btn.FlatStyle = FlatStyle.Flat;
                    btn.FlatAppearance.BorderSize = 1;
                    btn.FlatAppearance.BorderColor = String.Equals(fileId, currentId, StringComparison.Ordinal)
                        ? Color.FromArgb(209, 0, 160)
                        : Color.FromArgb(225, 228, 235);
                    btn.BackColor = String.Equals(fileId, currentId, StringComparison.Ordinal)
                        ? Color.FromArgb(255, 241, 250)
                        : Color.FromArgb(248, 249, 252);
                    btn.ForeColor = Color.FromArgb(32, 36, 48);
                    btn.TextAlign = ContentAlignment.MiddleLeft;
                    btn.Click += delegate
                    {
                        string id = Convert.ToString(btn.Tag);
                        if (webView.CoreWebView2 == null || String.IsNullOrEmpty(id)) return;
                        webView.CoreWebView2.ExecuteScriptAsync("openWorkbookFileFromList(" + JsString(id) + ");");
                    };
                    nativeFileTabs.Controls.Add(btn);
                }
            }
            finally
            {
                nativeFileTabs.ResumeLayout();
                PublishNativeBounds();
            }
        }

        private static string DecodeMessagePart(string value)
        {
            try
            {
                return Uri.UnescapeDataString(value ?? "");
            }
            catch
            {
                return value ?? "";
            }
        }

        private static string JsString(string value)
        {
            string text = value ?? "";
            StringBuilder sb = new StringBuilder();
            sb.Append('"');
            foreach (char ch in text)
            {
                switch (ch)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (ch < 32)
                        {
                            sb.Append("\\u");
                            sb.Append(((int)ch).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(ch);
                        }
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }

        private void StartPythonServer()
        {
            string bundledServer = Path.Combine(rootDir, "B2B_Server.exe");
            string python = FindPython();
            string server = Path.Combine(rootDir, "serve_b2b.py");

            ProcessStartInfo psi = new ProcessStartInfo();
            if (File.Exists(bundledServer))
            {
                psi.FileName = bundledServer;
                psi.Arguments = "";
            }
            else
            {
                if (!File.Exists(server)) throw new FileNotFoundException("serve_b2b.py not found", server);
                psi.FileName = python;
                psi.Arguments = "\"" + server + "\"";
            }
            psi.WorkingDirectory = rootDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.StandardOutputEncoding = Encoding.UTF8;
            psi.StandardErrorEncoding = Encoding.UTF8;
            psi.EnvironmentVariables["B2B_PORT"] = port.ToString();
            psi.EnvironmentVariables["B2B_HOST"] = "127.0.0.1";
            psi.EnvironmentVariables["B2B_NO_BROWSER"] = "1";
            psi.EnvironmentVariables["B2B_NATIVE_HOST_PID"] = Process.GetCurrentProcess().Id.ToString();
            psi.EnvironmentVariables["PYTHONUNBUFFERED"] = "1";
            serverProcess = Process.Start(psi);
            if (serverProcess == null) throw new InvalidOperationException("Python server did not start.");
            serverProcess.EnableRaisingEvents = true;
            serverProcess.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
            {
                if (!String.IsNullOrEmpty(e.Data)) Program.Log("[server] " + e.Data);
            };
            serverProcess.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
            {
                if (!String.IsNullOrEmpty(e.Data)) Program.Log("[server:err] " + e.Data);
            };
            serverProcess.Exited += (s, e) =>
            {
                Process exited = s as Process;
                try
                {
                    Program.Log("Python server exited code=" + (exited != null ? exited.ExitCode.ToString() : "?"));
                }
                catch
                {
                    Program.Log("Python server exited");
                }
                if (!shuttingDown && !restartingServer && ReferenceEquals(exited, serverProcess))
                {
                    HandleServerCrash();
                }
            };
            serverProcess.BeginOutputReadLine();
            serverProcess.BeginErrorReadLine();
            Program.Log("Started Python server pid=" + serverProcess.Id + " exe=" + psi.FileName + " root=" + rootDir);
        }

        private string FindPython()
        {
            string local = Path.Combine(rootDir, "python", "python.exe");
            if (File.Exists(local)) return local;
            return "python";
        }

        private int FindAvailablePort()
        {
            int[] candidates = new int[] { 18120, 18121, 18122, 18123, 18124, 18125, 18126, 18127 };
            foreach (int candidate in candidates)
            {
                try
                {
                    TcpListener listener = new TcpListener(IPAddress.Loopback, candidate);
                    listener.Start();
                    listener.Stop();
                    return candidate;
                }
                catch
                {
                }
            }
            throw new InvalidOperationException("No available local port for native host.");
        }

        private async Task WaitForServerAsync(string url, TimeSpan timeout)
        {
            DateTime deadline = DateTime.UtcNow + timeout;
            Exception last = null;
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                    req.Timeout = 1000;
                    using (HttpWebResponse resp = (HttpWebResponse)await req.GetResponseAsync())
                    {
                        if ((int)resp.StatusCode < 500) return;
                    }
                }
                catch (Exception ex)
                {
                    last = ex;
                }
                await Task.Delay(250);
            }
            throw new TimeoutException("Local server did not respond: " + (last == null ? "" : last.Message));
        }

        // 서버 프로세스가 예기치 않게 종료되면 자동 재시작(짧은 시간 내 반복 크래시는 중단).
        private void HandleServerCrash()
        {
            if (shuttingDown || restartingServer) return;
            DateTime now = DateTime.UtcNow;
            if ((now - lastServerRestartUtc).TotalSeconds > 60) recentRestartCount = 0;
            if (recentRestartCount >= 3)
            {
                Program.Log("Python server crashed repeatedly; auto-restart paused.");
                ExecuteWebScript("window.dispatchEvent(new Event('b2bServerCrashedFatal'));");
                return;
            }
            recentRestartCount++;
            lastServerRestartUtc = now;
            try
            {
                BeginInvoke(new Action(async delegate { await RestartPythonServerAsync(true); }));
            }
            catch
            {
            }
        }

        // 죽었거나 멈춘 서버를 강제 종료 후 같은 포트로 다시 띄운다. 웹 페이지는 그대로 유지.
        private async Task RestartPythonServerAsync(bool fromCrash)
        {
            if (restartingServer || shuttingDown) return;
            restartingServer = true;
            try
            {
                Program.Log("Restarting Python server (fromCrash=" + fromCrash + ")");
                ExecuteWebScript("window.dispatchEvent(new Event('b2bServerRestarting'));");
                try
                {
                    if (serverProcess != null && !serverProcess.HasExited)
                    {
                        serverProcess.Kill();
                        serverProcess.WaitForExit(3000);
                    }
                }
                catch (Exception ex)
                {
                    Program.Log("Kill old server failed: " + ex.Message);
                }
                StartPythonServer();
                await WaitForServerAsync(appUrl, TimeSpan.FromSeconds(20));
                Program.Log("Python server restarted OK.");
                ExecuteWebScript("window.dispatchEvent(new Event('b2bServerReconnected'));");
            }
            catch (Exception ex)
            {
                Program.Log("Restart failed: " + ex);
                ExecuteWebScript("window.dispatchEvent(new Event('b2bServerCrashedFatal'));");
            }
            finally
            {
                restartingServer = false;
            }
        }

        private void PublishNativeBounds()
        {
            if (!webReady || webView.CoreWebView2 == null) return;
            Rectangle rect = excelPanel.ClientRectangle;
            Point screen = excelPanel.PointToScreen(Point.Empty);
            string key = excelPanel.Handle.ToInt64() + ":" + screen.X + ":" + screen.Y + ":" + rect.Width + ":" + rect.Height;
            if (key == lastNativeBoundsKey) return;
            lastNativeBoundsKey = key;
            string script = string.Format(
                "window.__B2B_NATIVE_SHELL={{enabled:true,excelOverlay:true,excelParentHwnd:'{0}',nativeHostHwnd:'{1}',excelLeft:{2},excelTop:{3},excelWidth:{4},excelHeight:{5}}};window.dispatchEvent(new Event('b2bNativeResize'));",
                excelPanel.Handle.ToInt64(),
                Handle.ToInt64(),
                Math.Max(0, screen.X),
                Math.Max(0, screen.Y),
                Math.Max(320, rect.Width),
                Math.Max(240, rect.Height)
            );
            try
            {
                webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch
            {
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY && ((int)(long)m.WParam) == DEBUG_HOTKEY_ID)
            {
                // F8 전역 핫키: Excel 미러가 포커스를 가진 상태에서도 속도 디버그 패널을 토글한다.
                ToggleDebugPanel();
                return;
            }
            if (m.Msg == WM_SYSCOMMAND && (((int)(long)m.WParam) & 0xFFF0) == SC_MINIMIZE)
            {
                // 소유된(owned) Excel 미러가 포그라운드인 동안 작업표시줄의 호스트 버튼은
                // '활성 그룹'으로 표시된다. 이때 그 버튼을 클릭하면 Windows 는 "활성 창 버튼 클릭
                // = 최소화"로 처리해 호스트만 내려가고 미러가 붕 뜬다. 이 상황에서 사용자의 의도는
                // '앱으로 복귀'이므로 최소화 대신 호스트를 활성화한다.
                // (호스트 자신이 활성일 때의 최소화 — 타이틀바 버튼 등 — 는 그대로 동작)
                try
                {
                    IntPtr fg = GetForegroundWindow();
                    if (fg != IntPtr.Zero && fg != Handle && GetWindow(fg, GW_OWNER) == Handle)
                    {
                        Program.Log("Minimize intercepted (owned Excel foreground) -> activating host instead");
                        Activate();
                        return;
                    }
                }
                catch
                {
                }
            }
            base.WndProc(ref m);
        }

        private string DescribeForegroundWindow()
        {
            try
            {
                IntPtr fg = GetForegroundWindow();
                if (fg == IntPtr.Zero) return "(none)";
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(fg, sb, sb.Capacity);
                string owned = GetWindow(fg, GW_OWNER) == Handle ? " owned-by-host" : "";
                return fg.ToInt64() + " '" + sb.ToString() + "' cls=" + WindowClass(fg) + owned;
            }
            catch
            {
                return "(error)";
            }
        }

        private void HandleHostResize()
        {
            hostMinimized = WindowState == FormWindowState.Minimized;
            if (WindowState == FormWindowState.Minimized)
            {
                if (lastWindowState != FormWindowState.Minimized)
                {
                    // 진단: 누가/언제 호스트를 최소화시키는지 추적(원치 않는 최소화 이슈 분석용).
                    Program.Log("Host minimized; foreground=" + DescribeForegroundWindow());
                    // [필드#5] 스킬 on/off(미러 hide/show) 중 호스트가 의도치 않게 최소화되는
                    // 간헐 현상 — busy 작업 중의 최소화는 사용자 의도가 아니므로 즉시 복귀한다.
                    if (uiBusyActive)
                    {
                        Program.Log("Auto-restore: minimized during busy work");
                        WindowState = FormWindowState.Maximized;
                        return;
                    }
                    // [최소화 중 미러 유출] 백엔드에 '호스트 최소화'를 먼저 알린다 — hide-all '이후'에
                    // 완료되는 열기(업로드 직후 미리열기 수 초)나 위치/복구 폴링이 창을 되띄우던 레이스를
                    // 백엔드 표시 게이트가 막는다. (hide-all 은 기존처럼 함께 전송.)
                    PostHostMinimizedState(true);
                    HideAllExcelMirrors();
                }
                lastWindowState = WindowState;
                return;
            }
            // 최대화 고정: 복원/리사이즈로 Normal 이 되면 즉시 다시 최대화한다(최소화만 허용).
            if (WindowState == FormWindowState.Normal)
            {
                WindowState = FormWindowState.Maximized;  // 다시 Resize 발생 → Maximized 분기로 진행
                return;
            }
            bool restoredFromMinimized = lastWindowState == FormWindowState.Minimized;
            lastWindowState = WindowState;
            PublishNativeBounds();
            if (restoredFromMinimized)
            {
                // 복원 재배치가 백엔드 표시 게이트에 막히지 않도록 '최소화 해제'를 먼저 알린다.
                PostHostMinimizedState(false);
                // [필드 추가#2] 최소화 복귀 직후엔 JS 가 아직 옛 패널 rect 를 들고 있어 미러가
                // 엉뚱한 위치에 따로 뜰 수 있다 — 위치 재계산(force)을 먼저 시키고 잠시 뒤 복원한다.
                ExecuteWebScript(
                    "if (typeof scheduleExcelMirrorPosition === 'function') scheduleExcelMirrorPosition(true);" +
                    "if (typeof scheduleRestoreActiveExcelMirror === 'function') scheduleRestoreActiveExcelMirror(240, { preserveFocus: true });");
            }
        }

        private void PostHostMinimizedState(bool minimized)
        {
            // 표시 게이트의 단일 진실원(백엔드 HOST_MINIMIZED) 갱신. 실패해도 hide-all/복원 스크립트가
            // 기존 동작을 유지하므로 치명적이지 않다(로그만 남김).
            int statePort = port;
            string stateAppUrl = appUrl;
            Task.Run(delegate
            {
                try
                {
                    if (String.IsNullOrEmpty(stateAppUrl) || statePort <= 0) return;
                    string url = "http://127.0.0.1:" + statePort + "/api/excel/host-state";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.Timeout = 1500;
                    req.ReadWriteTimeout = 1500;
                    byte[] body = Encoding.UTF8.GetBytes(minimized ? "{\"minimized\":true}" : "{\"minimized\":false}");
                    req.ContentLength = body.Length;
                    using (Stream s = req.GetRequestStream())
                    {
                        s.Write(body, 0, body.Length);
                    }
                    using (req.GetResponse())
                    {
                    }
                }
                catch (Exception ex)
                {
                    Program.Log("host-state post failed: " + ex.Message);
                }
            });
        }

        private void ExecuteWebScript(string script)
        {
            try
            {
                if (!webReady || webView.CoreWebView2 == null) return;
                webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch
            {
            }
        }

        private void HideAllExcelMirrors()
        {
            // UI 스레드에서 동기 HTTP(최대 1.5초)를 돌리면 최소화 처리가 멈칫한다 → 백그라운드로.
            // 빠른 최소화→복원 레이스: 전송 전/후로 최소화 상태를 재확인하고, 늦게 숨겨졌으면 즉시 복원.
            int hidePort = port;
            string hideAppUrl = appUrl;
            Task.Run(delegate
            {
                try
                {
                    if (String.IsNullOrEmpty(hideAppUrl) || hidePort <= 0) return;
                    if (!hostMinimized) return;
                    string hideUrl = "http://127.0.0.1:" + hidePort + "/api/excel/hide-all";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(hideUrl);
                    req.Method = "POST";
                    req.Timeout = 1500;
                    req.ReadWriteTimeout = 1500;
                    req.ContentLength = 0;
                    using (req.GetResponse())
                    {
                    }
                    if (!hostMinimized)
                    {
                        try { BeginInvoke(new Action(delegate { RestoreActiveExcelMirror(false); })); } catch { }
                    }
                }
                catch (Exception ex)
                {
                    Program.Log("Excel hide-all failed: " + ex.Message);
                }
            });
            ExecuteWebScript("if (typeof hideAllExcelMirrorWindows === 'function') hideAllExcelMirrorWindows();");
        }

        private void RestoreActiveExcelMirror(bool raiseWindow = false)
        {
            string options = raiseWindow ? "{}" : "{ preserveFocus: true }";
            ExecuteWebScript("if (typeof restoreActiveExcelMirrorWindow === 'function') restoreActiveExcelMirrorWindow(" + options + ");");
        }


        private void FocusExcelChild()
        {
            try
            {
                IntPtr child = FindBestExcelChild();
                if (child != IntPtr.Zero) FocusWindow(child);
            }
            catch
            {
            }
        }

        private void StartExcelFocusAssist()
        {
            excelFocusTimer = new System.Windows.Forms.Timer();
            excelFocusTimer.Interval = ExcelFocusIdleTimerIntervalMs;
            excelFocusTimer.Tick += delegate
            {
                try
                {
                    bool leftDown = (Control.MouseButtons & MouseButtons.Left) == MouseButtons.Left;
                    Point local = excelPanel.PointToClient(Cursor.Position);
                    bool overPanel = excelPanel.ClientRectangle.Contains(local);
                    bool fast = uiBusyActive || leftDown || overPanel;
                    int wanted = fast ? NativeFastTimerIntervalMs : ExcelFocusIdleTimerIntervalMs;
                    if (excelFocusTimer.Interval != wanted) excelFocusTimer.Interval = wanted;
                    if (!leftDown)
                    {
                        excelMouseDownFocused = false;
                        return;
                    }
                    if (excelMouseDownFocused) return;
                    if (!overPanel) return;
                    excelMouseDownFocused = true;
                    FocusExcelChild();
                }
                catch
                {
                }
            };
            excelFocusTimer.Start();
        }

        private IntPtr FindBestExcelChild()
        {
            IntPtr best = IntPtr.Zero;
            long bestScore = -1;
            try
            {
                EnumChildWindows(excelPanel.Handle, delegate(IntPtr hwnd, IntPtr lParam)
                {
                    try
                    {
                        if (!IsWindowVisible(hwnd)) return true;
                        RECT rect;
                        if (!GetWindowRect(hwnd, out rect)) return true;
                        long width = Math.Max(0, rect.Right - rect.Left);
                        long height = Math.Max(0, rect.Bottom - rect.Top);
                        long area = width * height;
                        if (area <= 0) return true;
                        string cls = WindowClass(hwnd);
                        long score = area;
                        if (cls.IndexOf("EXCEL7", StringComparison.OrdinalIgnoreCase) >= 0) score += 1000000000000L;
                        else if (cls.IndexOf("XLDESK", StringComparison.OrdinalIgnoreCase) >= 0) score += 100000000000L;
                        else if (cls.IndexOf("XLMAIN", StringComparison.OrdinalIgnoreCase) >= 0) score += 10000000000L;
                        if (score > bestScore)
                        {
                            bestScore = score;
                            best = hwnd;
                        }
                    }
                    catch
                    {
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch
            {
            }
            return best;
        }

        private string WindowClass(IntPtr hwnd)
        {
            try
            {
                StringBuilder sb = new StringBuilder(256);
                int len = GetClassName(hwnd, sb, sb.Capacity);
                return len > 0 ? sb.ToString() : "";
            }
            catch
            {
                return "";
            }
        }

        private void FocusWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return;
            uint processId;
            uint targetThread = GetWindowThreadProcessId(hwnd, out processId);
            uint currentThread = GetCurrentThreadId();
            bool attached = false;
            try
            {
                if (targetThread != 0 && targetThread != currentThread)
                {
                    attached = AttachThreadInput(currentThread, targetThread, true);
                }
                SetFocus(hwnd);
            }
            finally
            {
                if (attached)
                {
                    AttachThreadInput(currentThread, targetThread, false);
                }
            }
        }

        private void Cleanup()
        {
            shuttingDown = true;
            try
            {
                Program.Log("Cleanup starting");
                if (excelFocusTimer != null) excelFocusTimer.Stop();
                // 종료 중에는 Excel COM 이 Quit/Close 과정에서 top-level 회색 창을 잠깐 복원할 수 있다.
                // 먼저 현재 패널의 Excel HWND 와 서버 세션 창을 숨긴 뒤 닫아야 중앙 빈 창이 튀지 않는다.
                HideExcelChildren();
                HideAllExcelMirrors();
                if (!string.IsNullOrEmpty(appUrl))
                {
                    // [빠른 종료] graceful close-all(wb.Close, 대형 파일 건당 수 초 + COM 큐 대기,
                    // 최악 35초)은 종료 버튼이 수십 초 굳어 보이는 원인이었다. '초기화'와 같은 강제
                    // 정리 엔드포인트로 교체 — 서버가 앱 소유 EXCEL.EXE 를 pid 로 즉시 kill 하고
                    // (작업복사본 + SaveChanges:=False 라 데이터 손실 없음) kill 완료 후에 응답하므로
                    // '동기로 기다려야 고아가 안 남는다'는 기존 불변식은 그대로 유지된다.
                    // 타임아웃 예산: 서버측 정리는 EXCEL_LOCK 대기(2s) + pid당 taskkill(최대 3s, 순차)
                    // + 생존확인(3s) + 진행 중이던 비동기 kill join(최대 8s) + 임시파일/노드워커 정리.
                    // pid 가 4개(공유 라이브 + python skill + 격리 전체실행 + companion)면 15초로는 모자라,
                    // 타임아웃 → 폴백(빈 상태로 즉시 ok) → 서버 Kill 로 '정리 중인 서버'를 끊어 Excel 이
                    // 고아로 남았다(구 코드의 35s > 서버 내부 20s 라는 예산 관계가 축소하며 깨진 것).
                    // 정리 중에도 창은 이미 숨겨져 사용자는 종료된 것으로 보이므로 넉넉히 준다.
                    string closeUrl = "http://127.0.0.1:" + port + "/api/app/shutdown";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(closeUrl);
                    req.Method = "POST";
                    req.Timeout = 40000;
                    req.ReadWriteTimeout = 40000;
                    byte[] body = Encoding.UTF8.GetBytes("{}");
                    req.ContentType = "application/json";
                    req.ContentLength = body.Length;
                    using (Stream stream = req.GetRequestStream())
                    {
                        stream.Write(body, 0, body.Length);
                    }
                    using (req.GetResponse()) { }
                    Program.Log("App shutdown endpoint completed");
                }
            }
            catch (Exception ex)
            {
                Program.Log("App shutdown failed: " + ex.Message);
                // [구/신 혼합] rootDir 에 구버전 B2B_Server.exe 가 남은 채 호스트만 갱신되면
                // /api/app/shutdown 이 404 다. 구 서버의 force-restart 는 wait 파라미터가 없어
                // 무조건 백그라운드 kill 후 즉시 응답 → 곧바로 serverProcess.Kill() 이 그 스레드를
                // 끊어 Excel 이 고아로 남는다(구 호스트는 동기 close-all(35s)이라 안전했으므로
                // 이 조합에서만 생기는 회귀). 404 면 구 서버가 확실하므로 '동기' close-all 로 되돌린다.
                bool notFound = false;
                WebException wex = ex as WebException;
                if (wex != null && wex.Response is HttpWebResponse)
                {
                    notFound = ((HttpWebResponse)wex.Response).StatusCode == HttpStatusCode.NotFound;
                }
                if (notFound)
                {
                    Program.Log("Old server detected (404) — falling back to synchronous close-all");
                    TryPostShutdownJson("/api/excel/close-all", 35000);
                }
                else
                {
                    TryPostShutdownJson("/api/excel/force-restart", 8000);
                }
            }
            HideExcelChildren();
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(2000);
                    Program.Log("Killed Python server pid=" + serverProcess.Id);
                }
            }
            catch
            {
            }
            try
            {
                if (!String.IsNullOrEmpty(webViewUserDataDir) && Directory.Exists(webViewUserDataDir))
                {
                    Directory.Delete(webViewUserDataDir, true);
                }
            }
            catch
            {
            }
        }

        private void TryPostShutdownJson(string path, int timeoutMs)
        {
            try
            {
                if (String.IsNullOrEmpty(path)) return;
                string url = "http://127.0.0.1:" + port + path;
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                byte[] body = Encoding.UTF8.GetBytes("{}");
                req.ContentType = "application/json";
                req.ContentLength = body.Length;
                using (Stream stream = req.GetRequestStream())
                {
                    stream.Write(body, 0, body.Length);
                }
                using (req.GetResponse()) { }
                Program.Log("Shutdown endpoint completed: " + path);
            }
            catch (Exception ex)
            {
                Program.Log("Shutdown endpoint failed " + path + ": " + ex.Message);
            }
        }

        private void HideExcelChildren()
        {
            try
            {
                EnumChildWindows(excelPanel.Handle, delegate(IntPtr hwnd, IntPtr lParam)
                {
                    ShowWindow(hwnd, 0);
                    return true;
                }, IntPtr.Zero);
            }
            catch
            {
            }
        }
    }
}
