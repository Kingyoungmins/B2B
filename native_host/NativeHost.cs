using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
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
        public static readonly string RuntimeDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "B2B_Billing_Agent",
            "embedded_runtime"
        );
        public static readonly string LogPath = Path.Combine(RuntimeDir, "native_host.log");
        private static bool embeddedRuntimeReady;

        public static void Log(string message)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
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

        public static void InstallEmbeddedAssemblyResolver()
        {
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args)
            {
                try
                {
                    AssemblyName name = new AssemblyName(args.Name);
                    string dllName = name.Name + ".dll";
                    if (!String.Equals(dllName, "Microsoft.Web.WebView2.Core.dll", StringComparison.OrdinalIgnoreCase)
                        && !String.Equals(dllName, "Microsoft.Web.WebView2.WinForms.dll", StringComparison.OrdinalIgnoreCase))
                    {
                        return null;
                    }
                    string path = EnsureEmbeddedResourceFile(dllName, false);
                    return File.Exists(path) ? Assembly.LoadFrom(path) : null;
                }
                catch
                {
                    return null;
                }
            };
        }

        public static string EnsureBundledRuntimeFiles()
        {
            if (embeddedRuntimeReady) return RuntimeDir;
            Directory.CreateDirectory(RuntimeDir);
            bool hasEmbeddedServer = HasEmbeddedResourceFile("B2B_Server.exe");
            bool hasEmbeddedNode = HasEmbeddedResourceFile("node.exe");
            if (!hasEmbeddedServer && !hasEmbeddedNode)
            {
                embeddedRuntimeReady = true;
                return RuntimeDir;
            }
            EnsureEmbeddedResourceFile("B2B_Server.exe", hasEmbeddedServer);
            EnsureEmbeddedResourceFile("node.exe", hasEmbeddedNode);
            EnsureEmbeddedResourceFile("Microsoft.Web.WebView2.Core.dll", false);
            EnsureEmbeddedResourceFile("Microsoft.Web.WebView2.WinForms.dll", false);
            EnsureEmbeddedResourceFile("WebView2Loader.dll", false);
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            if (path.IndexOf(RuntimeDir, StringComparison.OrdinalIgnoreCase) < 0)
            {
                Environment.SetEnvironmentVariable("PATH", RuntimeDir + Path.PathSeparator + path);
            }
            embeddedRuntimeReady = true;
            Log("Embedded runtime ready at " + RuntimeDir);
            return RuntimeDir;
        }

        private static bool HasEmbeddedResourceFile(string fileName)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            string suffix = "." + fileName.Replace("\\", ".").Replace("/", ".");
            foreach (string name in asm.GetManifestResourceNames())
            {
                if (name.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
                    || String.Equals(name, fileName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static string EnsureEmbeddedResourceFile(string fileName, bool required)
        {
            string target = Path.Combine(RuntimeDir, fileName);

            Assembly asm = Assembly.GetExecutingAssembly();
            string suffix = "." + fileName.Replace("\\", ".").Replace("/", ".");
            string resourceName = null;
            foreach (string name in asm.GetManifestResourceNames())
            {
                if (name.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
                    || String.Equals(name, fileName, StringComparison.OrdinalIgnoreCase))
                {
                    resourceName = name;
                    break;
                }
            }

            if (resourceName == null)
            {
                if (File.Exists(target)) return target;
                if (required) throw new FileNotFoundException("Embedded resource not found", fileName);
                return target;
            }

            Directory.CreateDirectory(RuntimeDir);
            using (Stream input = asm.GetManifestResourceStream(resourceName))
            {
                if (input == null)
                {
                    if (required) throw new FileNotFoundException("Embedded resource stream not found", resourceName);
                    return target;
                }
                string tmp = target + ".tmp";
                using (FileStream output = File.Create(tmp))
                {
                    input.CopyTo(output);
                }
                if (File.Exists(target)) File.Delete(target);
                File.Move(tmp, target);
            }
            return target;
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
            InstallEmbeddedAssemblyResolver();
            Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e) { ShowFatal(e.Exception); };
            AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
            {
                Exception ex = e.ExceptionObject as Exception;
                ShowFatal(ex ?? new Exception(Convert.ToString(e.ExceptionObject)));
            };
            try
            {
                Log("Native host starting");
                EnsureBundledRuntimeFiles();
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
        private System.Windows.Forms.Timer excelFocusTimer;
        private bool excelMouseDownFocused;
        private FormWindowState lastWindowState;
        private volatile bool hostMinimized;
        private bool shuttingDown;
        private bool restartingServer;
        private DateTime lastServerRestartUtc = DateTime.MinValue;
        private int recentRestartCount;
        // 작업 잠금(UI busy): WebView 의 DOM 오버레이는 왼쪽 웹 영역만 덮는다.
        // 오른쪽 네이티브 파일탭과 Excel 창(별도 HWND)은 여기서 직접 잠근다.
        private Form uiBusyOverlay;
        private Label uiBusyOverlayLabel;
        private System.Windows.Forms.Timer uiBusyRevealTimer;
        private System.Windows.Forms.Timer uiBusyFailsafeTimer;
        private bool uiBusyActive;
        private string uiBusyLabelText = "작업 중...";

        private delegate bool EnumWindowProc(IntPtr hwnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumChildWindows(IntPtr hwndParent, EnumWindowProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

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

            Load += async (s, e) => await InitializeAsync();
            Shown += (s, e) => ApplyInitialSplitterLayout();
            FormClosing += (s, e) => Cleanup();
            Resize += (s, e) => HandleHostResize();
            Move += (s, e) => PublishNativeBounds();
            Activated += (s, e) =>
            {
                PublishNativeBounds();
                // 다른 앱에 갔다가 복귀: 작업이 아직 진행 중이면 차단막을 다시 깐다.
                if (uiBusyActive) ShowUiBusyOverlay();
                // 호스트 창(웹뷰 + 네이티브 탭 포함)이 활성화됨 → JS에 알림.
                // 여기서 즉시 Excel 을 복원하면 비활성 WebView 의 첫 버튼 클릭이 포커스/raise 처리에
                // 소비될 수 있어, 실제 복원은 JS 의 지연 스케줄이나 최소화 복원 경로에서만 수행한다.
                ExecuteWebScript("window.dispatchEvent(new Event('b2bHostActivated'));");
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
                // TopMost 차단막이 다른 앱 위에 떠 있지 않게 비활성화 동안은 숨긴다(상태는 유지).
                if (uiBusyActive) HideUiBusyOverlay();
            };
            split.SplitterMoved += (s, e) => PublishNativeBounds();
            excelPanel.Resize += (s, e) => PublishNativeBounds();
            lastWindowState = WindowState;
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
            try
            {
                string embedded = Program.EnsureBundledRuntimeFiles();
                if (File.Exists(Path.Combine(embedded, "B2B_Server.exe"))) return embedded;
            }
            catch (Exception ex)
            {
                Program.Log("Embedded runtime unavailable: " + ex.Message);
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
                webView.CoreWebView2.NavigationCompleted += delegate
                {
                    webReady = true;
                    if (startupSplash != null) startupSplash.Visible = false;  // 준비 완료 → 스플래시 숨김
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
                foreach (string dir in Directory.GetDirectories(baseDir, "ver044_*"))
                {
                    try
                    {
                        DirectoryInfo info = new DirectoryInfo(dir);
                        if (DateTime.UtcNow - info.LastWriteTimeUtc > TimeSpan.FromDays(2))
                        {
                            info.Delete(true);
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
            return await CoreWebView2Environment.CreateAsync(null, webViewUserDataDir);
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
            if (message.StartsWith("B2B_UI_BUSY\t", StringComparison.Ordinal))
            {
                UpdateUiBusy(message);
                return;
            }
            if (message == "B2B_RESTART_SERVER")
            {
                Task ignore = RestartPythonServerAsync(false);
                return;
            }
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
            // 패널 로딩 라벨과 busy 오버레이 라벨이 겹쳐 이중 표기되지 않게 표현을 갱신.
            RefreshUiBusyOverlayPresentation();
        }

        private void UpdateUiBusy(string message)
        {
            string[] parts = message.Split('\t');
            bool active = parts.Length > 1 && parts[1] == "1";
            string text = parts.Length > 2 ? DecodeMessagePart(parts[2]) : "";
            SetUiBusy(active, text);
        }

        private void SetUiBusy(bool active, string text)
        {
            uiBusyActive = active;
            if (!String.IsNullOrWhiteSpace(text)) uiBusyLabelText = text;
            try
            {
                nativeFileTabs.Enabled = !active;
            }
            catch
            {
            }
            if (active)
            {
                ShowUiBusyOverlay();
                // WebView 쪽 해제 메시지가 유실돼도(페이지 리로드/크래시) 잠금이 영구화되지 않게
                // 자체 failsafe 로 푼다(JS 의 90초 failsafe 보다 약간 길게).
                if (uiBusyFailsafeTimer == null)
                {
                    uiBusyFailsafeTimer = new System.Windows.Forms.Timer();
                    uiBusyFailsafeTimer.Interval = 100000;
                    uiBusyFailsafeTimer.Tick += delegate
                    {
                        Program.Log("UI busy failsafe release");
                        SetUiBusy(false, "");
                    };
                }
                uiBusyFailsafeTimer.Stop();
                uiBusyFailsafeTimer.Start();
            }
            else
            {
                if (uiBusyFailsafeTimer != null) uiBusyFailsafeTimer.Stop();
                HideUiBusyOverlay();
            }
        }

        private void ShowUiBusyOverlay()
        {
            if (hostMinimized || WindowState == FormWindowState.Minimized) return;
            // 호스트(또는 호스트가 소유한 Excel 미러)가 포그라운드가 아니면 깔지 않는다 —
            // TopMost 차단막이 사용자가 보고 있는 다른 앱 위에 뜨면 안 된다. 복귀 시 Activated 에서 다시 깐다.
            try
            {
                IntPtr fg = GetForegroundWindow();
                bool hostForeground = fg == Handle || (fg != IntPtr.Zero && GetWindow(fg, GW_OWNER) == Handle);
                if (!hostForeground) return;
            }
            catch
            {
            }
            if (uiBusyOverlay == null || uiBusyOverlay.IsDisposed)
            {
                uiBusyOverlay = new ClickBlockOverlayForm();
                uiBusyOverlay.Owner = this;
                uiBusyOverlayLabel = new Label();
                uiBusyOverlayLabel.Dock = DockStyle.Fill;
                uiBusyOverlayLabel.TextAlign = ContentAlignment.MiddleCenter;
                uiBusyOverlayLabel.Font = new Font(Font.FontFamily, 11F, FontStyle.Bold);
                uiBusyOverlayLabel.ForeColor = Color.FromArgb(96, 96, 112);
                uiBusyOverlayLabel.Cursor = Cursors.WaitCursor;
                uiBusyOverlayLabel.Visible = false;
                uiBusyOverlay.Controls.Add(uiBusyOverlayLabel);
            }
            PositionUiBusyOverlay();
            if (!uiBusyOverlay.Visible)
            {
                // 즉시 입력만 차단(거의 투명), 잠깐의 전환에서는 시각적 깜빡임이 없게
                // 짧은 지연 후에만 반투명+라벨을 보여준다(웹 오버레이의 showDelay 와 동일한 발상).
                uiBusyOverlay.Opacity = 0.02;
                uiBusyOverlayLabel.Visible = false;
                uiBusyOverlay.Show();
            }
            if (uiBusyRevealTimer == null)
            {
                uiBusyRevealTimer = new System.Windows.Forms.Timer();
                uiBusyRevealTimer.Interval = 200;
                uiBusyRevealTimer.Tick += delegate
                {
                    uiBusyRevealTimer.Stop();
                    RefreshUiBusyOverlayPresentation();
                };
            }
            uiBusyRevealTimer.Stop();
            uiBusyRevealTimer.Start();
        }

        private void RefreshUiBusyOverlayPresentation()
        {
            try
            {
                if (!uiBusyActive || uiBusyOverlay == null || uiBusyOverlay.IsDisposed || !uiBusyOverlay.Visible) return;
                if (uiBusyRevealTimer != null && uiBusyRevealTimer.Enabled) return; // 아직 지연 표시 전
                if (excelLoadingLabel.Visible)
                {
                    // 패널 로딩 라벨(스피너)이 이미 상태를 보여주는 중 → 오버레이는 클릭 방패 역할만.
                    uiBusyOverlay.Opacity = 0.06;
                    uiBusyOverlayLabel.Visible = false;
                }
                else
                {
                    uiBusyOverlay.Opacity = 0.42;
                    uiBusyOverlayLabel.Text = uiBusyLabelText;
                    uiBusyOverlayLabel.Visible = true;
                }
            }
            catch
            {
            }
        }

        private void PositionUiBusyOverlay()
        {
            if (uiBusyOverlay == null || uiBusyOverlay.IsDisposed) return;
            try
            {
                uiBusyOverlay.Bounds = excelPanel.RectangleToScreen(excelPanel.ClientRectangle);
            }
            catch
            {
            }
        }

        private void HideUiBusyOverlay()
        {
            if (uiBusyRevealTimer != null) uiBusyRevealTimer.Stop();
            try
            {
                if (uiBusyOverlay != null && !uiBusyOverlay.IsDisposed && uiBusyOverlay.Visible)
                {
                    uiBusyOverlay.Hide();
                }
            }
            catch
            {
            }
        }

        // Excel 미러 창(별도 최상위 HWND) 위를 덮어 클릭을 흡수하는 차단막.
        // WS_EX_NOACTIVATE: 클릭해도 포커스를 뺏지 않고 입력만 흡수(활성화 루프 방지).
        // WS_EX_TOOLWINDOW: 작업표시줄/Alt+Tab 에 노출되지 않음.
        private sealed class ClickBlockOverlayForm : Form
        {
            public ClickBlockOverlayForm()
            {
                FormBorderStyle = FormBorderStyle.None;
                ShowInTaskbar = false;
                StartPosition = FormStartPosition.Manual;
                TopMost = true;
                BackColor = Color.FromArgb(250, 250, 252);
                Cursor = Cursors.WaitCursor;
                Opacity = 0.02;
            }

            protected override bool ShowWithoutActivation
            {
                get { return true; }
            }

            protected override CreateParams CreateParams
            {
                get
                {
                    CreateParams cp = base.CreateParams;
                    cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE
                    cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW
                    return cp;
                }
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
            PositionUiBusyOverlay();
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
                    HideAllExcelMirrors();
                    if (uiBusyActive) HideUiBusyOverlay();
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
                RestoreActiveExcelMirror();
            }
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
                        try { BeginInvoke(new Action(RestoreActiveExcelMirror)); } catch { }
                    }
                }
                catch (Exception ex)
                {
                    Program.Log("Excel hide-all failed: " + ex.Message);
                }
            });
            ExecuteWebScript("if (typeof hideAllExcelMirrorWindows === 'function') hideAllExcelMirrorWindows();");
        }

        private void RestoreActiveExcelMirror()
        {
            ExecuteWebScript("if (typeof restoreActiveExcelMirrorWindow === 'function') restoreActiveExcelMirrorWindow();");
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
            excelFocusTimer.Interval = 80;
            excelFocusTimer.Tick += delegate
            {
                try
                {
                    bool leftDown = (Control.MouseButtons & MouseButtons.Left) == MouseButtons.Left;
                    if (!leftDown)
                    {
                        excelMouseDownFocused = false;
                        return;
                    }
                    if (excelMouseDownFocused) return;
                    Point local = excelPanel.PointToClient(Cursor.Position);
                    if (!excelPanel.ClientRectangle.Contains(local)) return;
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
                if (!string.IsNullOrEmpty(appUrl))
                {
                    string closeUrl = "http://127.0.0.1:" + port + "/api/excel/close-all";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(closeUrl);
                    req.Method = "POST";
                    // 종료 시 close-all 은 반드시 동기로 기다린다(비동기화하면 서버 kill 과 경합해
                    // 공유 EXCEL.EXE 가 고아로 남는다). 대기 한도만 25s→15s 로 줄여 종료 체감 개선.
                    req.Timeout = 15000;
                    req.ReadWriteTimeout = 15000;
                    byte[] body = Encoding.UTF8.GetBytes("{}");
                    req.ContentType = "application/json";
                    req.ContentLength = body.Length;
                    using (Stream stream = req.GetRequestStream())
                    {
                        stream.Write(body, 0, body.Length);
                    }
                    using (req.GetResponse()) { }
                    Program.Log("Excel close-all completed");
                }
            }
            catch (Exception ex)
            {
                Program.Log("Excel close-all failed: " + ex.Message);
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
