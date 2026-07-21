using System;
using System.Drawing;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

// ===================================================================
// Excel Embed Prototype (ver0.4.4)
// SetParent 으로 실제 Excel 창을 패널 안에 자식 창으로 넣고,
// 지속적 AttachThreadInput 으로 클릭/드래그 선택이 되는지 격리 검증한다.
//
// 검증 포인트:
//  1) "2) 패널에 임베드" 후 그리드에서 셀 클릭/드래그 → 상단 "선택:" 라벨이
//     클릭/드래그한 주소로 바뀌면 마우스 선택 성공.
//  2) "3) Range.Select(B61)" → COM 으로 선택 이동이 되는지(또는 오류) 확인.
//  3) 상단 체크박스로 AttachThreadInput / 포커스보정 / MouseActivate 를 켜고 끄며
//     무엇이 있어야 동작하는지 A/B 비교.
//
// Excel 은 late binding(리플렉션)으로 호출하므로 Office PIA 참조가 필요 없다.
// ===================================================================
namespace B2BEmbedProto
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ProtoForm());
        }
    }

    // COM 호출 거부(RPC_E_CALL_REJECTED / SERVERCALL_RETRYLATER) 재시도용 메시지 필터.
    // WinForms UI 스레드에서 Excel COM 을 폴링할 때 "Call was rejected by callee" 를 방지한다.
    [ComImport, Guid("00000016-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IOleMessageFilter
    {
        [PreserveSig] int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo);
        [PreserveSig] int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType);
        [PreserveSig] int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType);
    }

    class ExcelMessageFilter : IOleMessageFilter
    {
        [DllImport("ole32.dll")]
        private static extern int CoRegisterMessageFilter(IOleMessageFilter newFilter, out IOleMessageFilter oldFilter);

        public static void Register()
        {
            IOleMessageFilter old;
            CoRegisterMessageFilter(new ExcelMessageFilter(), out old);
        }
        public static void Revoke()
        {
            IOleMessageFilter old;
            CoRegisterMessageFilter(null, out old);
        }

        public int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo)
        {
            return 0; // SERVERCALL_ISHANDLED
        }
        public int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType)
        {
            if (dwRejectType == 2 /* SERVERCALL_RETRYLATER */ && dwTickCount < 10000)
                return 200; // 200ms 후 재시도
            return -1; // 취소
        }
        public int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType)
        {
            return 2; // PENDINGMSG_WAITDEFPROCESS
        }
    }

    // 패널 자체가 클릭될 때 호스트가 활성화를 가로채지 않도록 MouseActivate 를 제어.
    public class EmbedPanel : Panel
    {
        public bool SuppressMouseActivate = true;
        private const int WM_MOUSEACTIVATE = 0x0021;
        private const int MA_NOACTIVATE = 3;

        public EmbedPanel()
        {
            SetStyle(ControlStyles.Selectable, false);
        }

        protected override void WndProc(ref Message m)
        {
            if (SuppressMouseActivate && m.Msg == WM_MOUSEACTIVATE)
            {
                m.Result = (IntPtr)MA_NOACTIVATE;
                return;
            }
            base.WndProc(ref m);
        }
    }

    public class ProtoForm : Form
    {
        // --- Win32 ---
        private delegate bool EnumWindowProc(IntPtr hwnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumChildWindows(IntPtr hwndParent, EnumWindowProc lpEnumFunc, IntPtr lParam);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        private static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        private static extern IntPtr SetFocus(IntPtr hWnd);
        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left, Top, Right, Bottom; }

        private const int GWL_STYLE = -16;
        private const int WS_CHILD = 0x40000000;
        private const int WS_POPUP = unchecked((int)0x80000000);
        private const int WS_VISIBLE = 0x10000000;
        private const int WS_CAPTION = 0x00C00000;
        private const int WS_THICKFRAME = 0x00040000;
        private const int WS_MINIMIZEBOX = 0x00020000;
        private const int WS_MAXIMIZEBOX = 0x00010000;
        private const int WS_SYSMENU = 0x00080000;
        private const int WS_CLIPSIBLINGS = 0x04000000;
        private const int WS_CLIPCHILDREN = 0x02000000;
        private const int WS_DISABLED = 0x08000000;
        private const int SW_SHOWNORMAL = 1;
        private const int SW_SHOWNA = 8;
        private const int VK_LBUTTON = 0x01;
        private const int GWLP_HWNDPARENT = -8;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const uint SWP_NOOWNERZORDER = 0x0200;
        private static readonly IntPtr HWND_TOP = IntPtr.Zero;

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_APPWINDOW = 0x00040000;

        private enum EmbedMode { None, Child, OwnedPopup, FreeOverlay }
        private EmbedMode mode = EmbedMode.None;

        // --- UI ---
        private readonly EmbedPanel host;
        private readonly Label lblSel;
        private readonly TextBox log;
        private readonly CheckBox chkAttach;
        private readonly CheckBox chkFocus;
        private readonly CheckBox chkMouseActivate;
        private readonly System.Windows.Forms.Timer timer;

        // --- Excel late-bound state ---
        private object excelApp;
        private IntPtr xlHwnd = IntPtr.Zero;
        private uint xlThreadId;
        private bool embedded;
        private bool attached;
        private bool mouseDownFocused;

        public ProtoForm()
        {
            ExcelMessageFilter.Register();
            Text = "Excel Embed Prototype (ver0.4.4)";
            StartPosition = FormStartPosition.CenterScreen;
            Width = 1200;
            Height = 820;
            MinimumSize = new Size(900, 600);

            TableLayoutPanel root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 4;
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 44F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 28F));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 120F));
            Controls.Add(root);

            FlowLayoutPanel toolbar = new FlowLayoutPanel();
            toolbar.Dock = DockStyle.Fill;
            toolbar.WrapContents = false;
            toolbar.Padding = new Padding(4, 6, 4, 4);

            Button btnLaunch = MakeButton("1) Excel 실행", 120);
            btnLaunch.Click += delegate { LaunchExcel(); };
            Button btnChild = MakeButton("2) 자식 임베드(WS_CHILD)", 180);
            btnChild.Click += delegate { EmbedChild(); };
            Button btnOwned = MakeButton("2') 소유+활성 팝업", 150);
            btnOwned.Click += delegate { EmbedOwnedPopup(); };
            Button btnOverlay = MakeButton("2'') 자유 오버레이(0.4.3식)", 180);
            btnOverlay.Click += delegate { EmbedFreeOverlay(); };
            Button btnSelTest = MakeButton("3) Range.Select(B61)", 160);
            btnSelTest.Click += delegate { TestRangeSelect("B61"); };
            Button btnRead = MakeButton("선택 읽기(1회)", 110);
            btnRead.Click += delegate { ReadSelectionOnce(); };
            Button btnDump = MakeButton("창 구조 덤프", 110);
            btnDump.Click += delegate { DumpWindowTree(); };
            Button btnPop = MakeButton("분리(해제)", 100);
            btnPop.Click += delegate { PopOut(); };

            chkAttach = MakeCheck("AttachThreadInput 지속", true);
            chkAttach.CheckedChanged += delegate { ApplyAttach(); Log("AttachThreadInput 지속 = " + chkAttach.Checked); };
            chkFocus = MakeCheck("클릭 시 EXCEL7 포커스", true);
            chkMouseActivate = MakeCheck("패널 MouseActivate 제어", true);
            chkMouseActivate.CheckedChanged += delegate { host.SuppressMouseActivate = chkMouseActivate.Checked; Log("MouseActivate 제어 = " + chkMouseActivate.Checked); };

            toolbar.Controls.Add(btnLaunch);
            toolbar.Controls.Add(btnChild);
            toolbar.Controls.Add(btnOwned);
            toolbar.Controls.Add(btnOverlay);
            toolbar.Controls.Add(btnSelTest);
            toolbar.Controls.Add(btnRead);
            toolbar.Controls.Add(btnDump);
            toolbar.Controls.Add(btnPop);
            toolbar.Controls.Add(chkAttach);
            toolbar.Controls.Add(chkFocus);
            toolbar.Controls.Add(chkMouseActivate);
            root.Controls.Add(toolbar, 0, 0);

            lblSel = new Label();
            lblSel.Dock = DockStyle.Fill;
            lblSel.TextAlign = ContentAlignment.MiddleLeft;
            lblSel.Font = new Font("Consolas", 10F, FontStyle.Bold);
            lblSel.ForeColor = Color.FromArgb(180, 0, 120);
            lblSel.Text = "선택: (Excel 미연결)";
            root.Controls.Add(lblSel, 0, 1);

            host = new EmbedPanel();
            host.Dock = DockStyle.Fill;
            host.BackColor = Color.FromArgb(245, 246, 250);
            host.SuppressMouseActivate = chkMouseActivate.Checked;
            root.Controls.Add(host, 0, 2);

            log = new TextBox();
            log.Dock = DockStyle.Fill;
            log.Multiline = true;
            log.ReadOnly = true;
            log.ScrollBars = ScrollBars.Vertical;
            log.Font = new Font("Consolas", 9F);
            root.Controls.Add(log, 0, 3);

            timer = new System.Windows.Forms.Timer();
            timer.Interval = 250;
            timer.Tick += delegate { OnTick(); };
            timer.Start();

            Activated += delegate { OnHostActivated(); };
            FormClosing += delegate { Cleanup(); };
            host.Resize += delegate { FitExcelToHost(); };
            Move += delegate { FitExcelToHost(); };
            Resize += delegate { FitExcelToHost(); };

            Log("준비됨. [1) Excel 실행] → [2) 패널에 임베드] 순서로 누르세요.");
        }

        private static Button MakeButton(string text, int width)
        {
            Button b = new Button();
            b.Text = text;
            b.Width = width;
            b.Height = 30;
            b.Margin = new Padding(3, 2, 3, 2);
            return b;
        }

        private static CheckBox MakeCheck(string text, bool init)
        {
            CheckBox c = new CheckBox();
            c.Text = text;
            c.Checked = init;
            c.AutoSize = true;
            c.Margin = new Padding(10, 8, 3, 2);
            return c;
        }

        // ============================== Excel ==============================
        private void LaunchExcel()
        {
            try
            {
                if (excelApp != null)
                {
                    Log("이미 Excel 이 실행됨.");
                    return;
                }
                Type t = Type.GetTypeFromProgID("Excel.Application");
                if (t == null) throw new Exception("Excel.Application ProgID 를 찾을 수 없음 (Excel 미설치?)");
                excelApp = Activator.CreateInstance(t);
                Set(excelApp, "DisplayAlerts", false);
                TrySet(excelApp, "UserControl", true);
                TrySet(excelApp, "Interactive", true);
                Set(excelApp, "Visible", true);

                object workbooks = Get(excelApp, "Workbooks");
                object wb = Call(workbooks, "Add");
                object ws = Get(excelApp, "ActiveSheet");

                // 샘플 데이터 채우기 (드래그 선택을 눈으로 확인하기 좋게).
                int rows = 120, cols = 8;
                object[,] data = new object[rows, cols];
                string[] headers = new string[] { "항목", "A", "B", "C", "D", "E", "F", "G" };
                for (int c = 0; c < cols; c++) data[0, c] = headers[c];
                for (int r = 1; r < rows; r++)
                {
                    data[r, 0] = "row" + (r + 1);
                    for (int c = 1; c < cols; c++) data[r, c] = (r * 10 + c);
                }
                object range = Get(ws, "Range", "A1:H120");
                Set(range, "Value2", data);
                Call(Get(ws, "Range", "A1"), "Select");

                xlHwnd = new IntPtr((int)Get(excelApp, "Hwnd"));
                uint pid;
                xlThreadId = GetWindowThreadProcessId(xlHwnd, out pid);
                Log("Excel 실행됨. hwnd=0x" + xlHwnd.ToInt64().ToString("X") + " thread=" + xlThreadId + " pid=" + pid);
            }
            catch (Exception ex)
            {
                LogError("LaunchExcel", ex);
            }
        }

        // (A) 진짜 자식 창: WS_CHILD 로 패널 안에 넣음. 최신 Excel 에서 입력이 막히는지 확인용.
        private void EmbedChild()
        {
            try
            {
                if (excelApp == null) { Log("먼저 [1) Excel 실행] 을 누르세요."); return; }
                if (!IsWindow(xlHwnd)) { Log("Excel 창 hwnd 가 유효하지 않음."); return; }
                if (mode == EmbedMode.OwnedPopup) ApplyAttachInternal(false);

                int style = GetWindowLong(xlHwnd, GWL_STYLE);
                int desired = style;
                desired &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_POPUP | WS_DISABLED);
                desired |= WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN | WS_VISIBLE;
                if (desired != style) SetWindowLong(xlHwnd, GWL_STYLE, desired);

                SetParent(xlHwnd, host.Handle);
                mode = EmbedMode.Child;
                embedded = true;
                FitExcelToHost();
                ShowWindow(xlHwnd, SW_SHOWNA);

                ApplyAttach();
                FocusExcelGrid();
                Log("자식(WS_CHILD) 임베드 완료. 그리드에서 클릭/드래그 → '선택:' 라벨이 바뀌는지 확인.");
            }
            catch (Exception ex)
            {
                LogError("EmbedChild", ex);
            }
        }

        // (B) 소유 팝업: top-level(WS_POPUP) 로 두되 호스트가 owner. foreground 가능 → 입력 동작 기대.
        //     패널 화면좌표에 정확히 맞춰 위치 동기화 → 패널 안에 박힌 것처럼 보임.
        private void EmbedOwnedPopup()
        {
            try
            {
                if (excelApp == null) { Log("먼저 [1) Excel 실행] 을 누르세요."); return; }
                if (!IsWindow(xlHwnd)) { Log("Excel 창 hwnd 가 유효하지 않음."); return; }
                ApplyAttachInternal(false);

                // 자식이었다면 먼저 top-level 로 복귀.
                SetParent(xlHwnd, IntPtr.Zero);
                int style = GetWindowLong(xlHwnd, GWL_STYLE);
                int desired = style;
                desired &= ~(WS_CHILD | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_DISABLED);
                desired |= WS_POPUP | WS_CLIPSIBLINGS | WS_VISIBLE;
                if (desired != style) SetWindowLong(xlHwnd, GWL_STYLE, desired);

                int ex2 = GetWindowLong(xlHwnd, GWL_EXSTYLE);
                int desiredEx2 = (ex2 | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
                if (desiredEx2 != ex2) SetWindowLong(xlHwnd, GWL_EXSTYLE, desiredEx2);

                // 호스트 폼을 owner 로 지정 (z-order/최소화/종료 연동, 별도 작업표시줄 버튼 없음).
                SetWindowLongPtr64(xlHwnd, GWLP_HWNDPARENT, this.Handle);

                mode = EmbedMode.OwnedPopup;
                embedded = true;
                // 핵심: 활성화함 (SWP_NOACTIVATE 안 씀) → foreground 획득 → 입력 동작 기대.
                Point p2 = host.PointToScreen(Point.Empty);
                int w2 = Math.Max(50, host.ClientSize.Width);
                int h2 = Math.Max(50, host.ClientSize.Height);
                SetWindowPos(xlHwnd, HWND_TOP, p2.X, p2.Y, w2, h2, SWP_SHOWWINDOW);
                ShowWindow(xlHwnd, SW_SHOWNORMAL);
                Log("소유+활성 팝업 임베드 완료. 그리드 클릭/드래그 → 셀 강조가 움직이는지 확인.");
            }
            catch (Exception ex)
            {
                LogError("EmbedOwnedPopup", ex);
            }
        }

        // (C) 자유 오버레이 = 0.4.3 방식 충실 재현.
        //     owner 없음(GWL_HWNDPARENT=0), 활성화함(NOACTIVATE 안 씀) → foreground 가능 → 입력 동작 기대.
        private void EmbedFreeOverlay()
        {
            try
            {
                if (excelApp == null) { Log("먼저 [1) Excel 실행] 을 누르세요."); return; }
                if (!IsWindow(xlHwnd)) { Log("Excel 창 hwnd 가 유효하지 않음."); return; }
                ApplyAttachInternal(false);

                SetParent(xlHwnd, IntPtr.Zero);
                int style = GetWindowLong(xlHwnd, GWL_STYLE);
                int desired = style;
                desired &= ~(WS_CHILD | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_DISABLED);
                desired |= WS_POPUP | WS_CLIPSIBLINGS | WS_CLIPCHILDREN | WS_VISIBLE;
                if (desired != style) SetWindowLong(xlHwnd, GWL_STYLE, desired);

                int ex = GetWindowLong(xlHwnd, GWL_EXSTYLE);
                int desiredEx = (ex | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
                if (desiredEx != ex) SetWindowLong(xlHwnd, GWL_EXSTYLE, desiredEx);

                SetWindowLongPtr64(xlHwnd, GWLP_HWNDPARENT, IntPtr.Zero); // owner 없음

                mode = EmbedMode.FreeOverlay;
                embedded = true;
                Point p = host.PointToScreen(Point.Empty);
                int w = Math.Max(50, host.ClientSize.Width);
                int h = Math.Max(50, host.ClientSize.Height);
                // 최초 1회는 활성화(SWP_NOACTIVATE 안 씀) → foreground 획득.
                SetWindowPos(xlHwnd, HWND_TOP, p.X, p.Y, w, h, SWP_SHOWWINDOW);
                ShowWindow(xlHwnd, SW_SHOWNORMAL);
                Log("자유 오버레이(0.4.3식) 임베드 완료. 그리드 클릭/드래그 → 셀 강조가 움직이는지 확인.");
            }
            catch (Exception ex)
            {
                LogError("EmbedFreeOverlay", ex);
            }
        }

        private void PopOut()
        {
            try
            {
                if (mode == EmbedMode.None || !IsWindow(xlHwnd)) { Log("임베드 상태가 아님."); return; }
                ApplyAttachInternal(false);
                if (mode == EmbedMode.OwnedPopup)
                {
                    SetWindowLongPtr64(xlHwnd, GWLP_HWNDPARENT, IntPtr.Zero);
                }
                int style = GetWindowLong(xlHwnd, GWL_STYLE);
                style &= ~WS_CHILD;
                style |= WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU;
                SetWindowLong(xlHwnd, GWL_STYLE, style);
                SetParent(xlHwnd, IntPtr.Zero);
                SetWindowPos(xlHwnd, HWND_TOP, 120, 120, 900, 600, SWP_SHOWWINDOW | SWP_NOOWNERZORDER);
                ShowWindow(xlHwnd, SW_SHOWNORMAL);
                mode = EmbedMode.None;
                embedded = false;
                Log("분리됨 (다시 top-level 창).");
            }
            catch (Exception ex)
            {
                LogError("PopOut", ex);
            }
        }

        private void FitExcelToHost()
        {
            if (!embedded || !IsWindow(xlHwnd)) return;
            int w = Math.Max(50, host.ClientSize.Width);
            int h = Math.Max(50, host.ClientSize.Height);
            if (mode == EmbedMode.Child)
            {
                MoveWindow(xlHwnd, 0, 0, w, h, true);
            }
            else if (mode == EmbedMode.OwnedPopup || mode == EmbedMode.FreeOverlay)
            {
                Point p = host.PointToScreen(Point.Empty);
                // 재배치는 NOACTIVATE (드래그 중 포커스 가로채지 않도록). 최초 활성화는 Embed* 에서 1회 수행.
                SetWindowPos(xlHwnd, HWND_TOP, p.X, p.Y, w, h, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER);
            }
        }

        private void DumpWindowTree()
        {
            if (!IsWindow(xlHwnd)) { Log("Excel hwnd 없음."); return; }
            Log("--- 창 구조 (xlHwnd=0x" + xlHwnd.ToInt64().ToString("X") + " class=" + ClassOf(xlHwnd) + ") ---");
            DumpChildren(xlHwnd, 1);
        }

        private void DumpChildren(IntPtr parent, int depth)
        {
            EnumChildWindows(parent, delegate(IntPtr hwnd, IntPtr lp)
            {
                RECT rc; GetWindowRect(hwnd, out rc);
                string indent = new string(' ', depth * 2);
                Log(indent + ClassOf(hwnd) + " vis=" + IsWindowVisible(hwnd) + " " + (rc.Right - rc.Left) + "x" + (rc.Bottom - rc.Top));
                return true;
            }, IntPtr.Zero);
        }

        private void TestRangeSelect(string addr)
        {
            if (excelApp == null) { Log("Excel 미실행."); return; }
            // 단계별로 무엇이 실패하는지 로깅.
            object ws = null;
            try { TrySet(excelApp, "Interactive", true); } catch { }
            try { Set(excelApp, "Visible", true); } catch (Exception ex) { LogError("Visible", ex); }
            try { object wb = Get(excelApp, "ActiveWorkbook"); if (wb != null) Call(wb, "Activate"); }
            catch (Exception ex) { LogError("Workbook.Activate", ex); }
            try { ws = Get(excelApp, "ActiveSheet"); if (ws == null) { Log("ActiveSheet=null (Excel 비활성 상태)"); return; } }
            catch (Exception ex) { LogError("ActiveSheet", ex); return; }
            try { Call(ws, "Activate"); } catch (Exception ex) { LogError("Sheet.Activate", ex); }
            object rng = null;
            try { rng = Get(ws, "Range", addr); } catch (Exception ex) { LogError("Range", ex); return; }
            try { Call(rng, "Select"); Log("Range.Select(" + addr + ") 성공."); return; }
            catch (Exception ex) { LogError("Range.Select", ex); }
            // 폴백: Application.Goto
            try { Call(excelApp, "Goto", rng, true); Log("Goto(" + addr + ") 폴백 성공."); }
            catch (Exception ex) { LogError("Goto 폴백", ex); }
        }

        private void ReadSelectionOnce()
        {
            if (excelApp == null) { Log("Excel 미실행."); return; }
            try
            {
                object sel = Get(excelApp, "Selection");
                object addr = Get(sel, "Address");
                object ws = Get(excelApp, "ActiveSheet");
                object name = ws != null ? Get(ws, "Name") : "(null)";
                Log("선택 읽기: " + Convert.ToString(name) + "!" + Convert.ToString(addr).Replace("$", ""));
            }
            catch (Exception ex)
            {
                LogError("ReadSelectionOnce", ex);
            }
        }

        // ============================== 입력/포커스 ==============================
        private void ApplyAttach()
        {
            ApplyAttachInternal(mode == EmbedMode.Child && chkAttach.Checked);
        }

        private void ApplyAttachInternal(bool on)
        {
            if (xlThreadId == 0) return;
            uint cur = GetCurrentThreadId();
            if (cur == xlThreadId) return;
            if (on && !attached)
            {
                attached = AttachThreadInput(cur, xlThreadId, true);
                Log("AttachThreadInput attach -> " + attached);
            }
            else if (!on && attached)
            {
                AttachThreadInput(cur, xlThreadId, false);
                attached = false;
                Log("AttachThreadInput detach");
            }
        }

        private void OnHostActivated()
        {
            if (!embedded) return;
            ApplyAttach();
            FocusExcelGrid();
        }

        private void OnTick()
        {
            UpdateSelectionLabel();
            if (mode == EmbedMode.Child && chkFocus.Checked)
            {
                bool leftDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
                if (!leftDown)
                {
                    mouseDownFocused = false;
                }
                else if (!mouseDownFocused)
                {
                    Point p = host.PointToClient(Cursor.Position);
                    if (host.ClientRectangle.Contains(p))
                    {
                        mouseDownFocused = true;
                        FocusExcelGrid();
                    }
                }
            }
        }

        private void UpdateSelectionLabel()
        {
            if (excelApp == null) return;
            try
            {
                object sel = Get(excelApp, "Selection");
                object addr = Get(sel, "Address");
                object ws = Get(excelApp, "ActiveSheet");
                object name = Get(ws, "Name");
                lblSel.Text = "선택: " + Convert.ToString(name) + "!" + Convert.ToString(addr).Replace("$", "")
                    + "   [mode=" + mode + (attached ? " attach ON]" : " attach OFF]");
            }
            catch (Exception ex)
            {
                Exception inner = (ex is TargetInvocationException && ex.InnerException != null) ? ex.InnerException : ex;
                lblSel.Text = "선택: (읽기 실패: " + inner.Message + ")";
                if (lastReadError != inner.Message)
                {
                    lastReadError = inner.Message;
                    Log("[read] Selection 읽기 실패: " + inner.GetType().Name + " - " + inner.Message);
                }
            }
        }
        private string lastReadError = "";

        private void FocusExcelGrid()
        {
            if (!IsWindow(xlHwnd)) return;
            IntPtr grid = FindBestExcelChild(xlHwnd);
            if (grid != IntPtr.Zero) SetFocus(grid);
        }

        private IntPtr FindBestExcelChild(IntPtr parent)
        {
            IntPtr best = parent;
            long bestScore = -1;
            EnumChildWindows(parent, delegate(IntPtr hwnd, IntPtr lp)
            {
                try
                {
                    if (!IsWindowVisible(hwnd)) return true;
                    RECT rc;
                    if (!GetWindowRect(hwnd, out rc)) return true;
                    long w = Math.Max(0, rc.Right - rc.Left);
                    long h = Math.Max(0, rc.Bottom - rc.Top);
                    long area = w * h;
                    if (area <= 0) return true;
                    string cls = ClassOf(hwnd).ToUpperInvariant();
                    long score = area;
                    if (cls.IndexOf("EXCEL7") >= 0) score += 1000000000000L;
                    else if (cls.IndexOf("XLDESK") >= 0) score += 100000000000L;
                    else if (cls.IndexOf("XLMAIN") >= 0) score += 10000000000L;
                    if (score > bestScore) { bestScore = score; best = hwnd; }
                }
                catch { }
                return true;
            }, IntPtr.Zero);
            return best;
        }

        private string ClassOf(IntPtr hwnd)
        {
            StringBuilder sb = new StringBuilder(256);
            int n = GetClassName(hwnd, sb, sb.Capacity);
            return n > 0 ? sb.ToString() : "";
        }

        // ============================== 종료 ==============================
        private void Cleanup()
        {
            try { timer.Stop(); } catch { }
            try { ApplyAttachInternal(false); } catch { }
            try
            {
                if (IsWindow(xlHwnd))
                {
                    if (mode == EmbedMode.OwnedPopup) SetWindowLongPtr64(xlHwnd, GWLP_HWNDPARENT, IntPtr.Zero);
                    SetParent(xlHwnd, IntPtr.Zero);
                }
            }
            catch { }
            try
            {
                if (excelApp != null)
                {
                    Set(excelApp, "DisplayAlerts", false);
                    object wb = Get(excelApp, "ActiveWorkbook");
                    if (wb != null) Call(wb, "Close", false);
                    Call(excelApp, "Quit");
                    Marshal.ReleaseComObject(excelApp);
                    excelApp = null;
                }
            }
            catch (Exception ex) { LogError("Cleanup", ex); }
            try { ExcelMessageFilter.Revoke(); } catch { }
        }

        // ============================== late binding helpers ==============================
        private static object Get(object o, string name, params object[] args)
        {
            return o.GetType().InvokeMember(name, BindingFlags.GetProperty, null, o, args);
        }
        private static object Call(object o, string name, params object[] args)
        {
            return o.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, o, args);
        }
        private static void Set(object o, string name, params object[] args)
        {
            o.GetType().InvokeMember(name, BindingFlags.SetProperty, null, o, args);
        }
        private static void TrySet(object o, string name, params object[] args)
        {
            try { Set(o, name, args); } catch { }
        }

        // ============================== log ==============================
        private void Log(string msg)
        {
            string line = DateTime.Now.ToString("HH:mm:ss.fff") + "  " + msg + "\r\n";
            if (log.InvokeRequired) log.BeginInvoke(new Action<string>(AppendLog), line);
            else AppendLog(line);
        }
        private void AppendLog(string line)
        {
            log.AppendText(line);
        }
        private void LogError(string where, Exception ex)
        {
            Exception inner = (ex is TargetInvocationException && ex.InnerException != null) ? ex.InnerException : ex;
            Log("[ERROR] " + where + ": " + inner.GetType().Name + " - " + inner.Message);
        }
    }
}
