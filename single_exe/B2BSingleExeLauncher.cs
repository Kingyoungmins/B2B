using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace B2BSingleExe
{
    internal static class Program
    {
        private const string Version = "0.6.2";
        private const string ResourceName = "payload.zip";
        private const string MainExeName = "B2B_ver0.6.2.exe";

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                string wrapperPath = Assembly.GetExecutingAssembly().Location;
                string wrapperDir = Path.GetDirectoryName(wrapperPath) ?? Environment.CurrentDirectory;
                CleanupOldExtracts();

                string extractDir = Path.Combine(
                    Path.GetTempPath(),
                    "B2B_ver0.6.2_single_" + Process.GetCurrentProcess().Id + "_" + DateTime.UtcNow.Ticks
                );
                Directory.CreateDirectory(extractDir);

                string payloadZip = Path.Combine(extractDir, "payload.zip");
                ExtractPayloadZip(payloadZip);
                ZipFile.ExtractToDirectory(payloadZip, extractDir);
                TryDelete(payloadZip);

                string mainExe = Path.Combine(extractDir, MainExeName);
                if (!File.Exists(mainExe))
                {
                    throw new FileNotFoundException("Packaged app entry was not found.", mainExe);
                }

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = mainExe;
                psi.WorkingDirectory = extractDir;
                psi.UseShellExecute = false;
                psi.EnvironmentVariables["B2B_WRITABLE_APP_DIR"] = wrapperDir;
                psi.EnvironmentVariables["B2B_SINGLE_EXE_PATH"] = wrapperPath;
                psi.EnvironmentVariables["B2B_SINGLE_EXE_EXTRACT_DIR"] = extractDir;
                Process child = Process.Start(psi);
                if (child == null) throw new InvalidOperationException("Failed to start packaged app.");
                child.WaitForExit();
                CleanupExtract(extractDir);
                return child.ExitCode;
            }
            catch (Exception ex)
            {
                try
                {
                    MessageBox.Show(
                        ex.ToString(),
                        "B2B start failed",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                catch
                {
                }
                return 1;
            }
        }

        private static void ExtractPayloadZip(string targetPath)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            Stream source = asm.GetManifestResourceStream(ResourceName);
            if (source == null)
            {
                foreach (string name in asm.GetManifestResourceNames())
                {
                    if (String.Equals(name, ResourceName, StringComparison.OrdinalIgnoreCase) ||
                        name.EndsWith("." + ResourceName, StringComparison.OrdinalIgnoreCase))
                    {
                        source = asm.GetManifestResourceStream(name);
                        break;
                    }
                }
            }
            if (source == null) throw new InvalidOperationException("Missing embedded payload.zip resource.");
            using (source)
            using (FileStream output = File.Create(targetPath))
            {
                source.CopyTo(output);
            }
        }

        private static void CleanupOldExtracts()
        {
            try
            {
                string temp = Path.GetTempPath();
                // 이전 실행이 남긴 모든 버전의 단일 exe 임시 폴더 정리. 이 함수는 현재 실행 폴더를 만들기 '전'에
                // 불리므로 여기 보이는 건 전부 죽은 실행의 잔재다. 사용 중(동시 실행 등)이면 잠겨서 예외 → 자연 스킵.
                // (예전엔 1일 임계 + 자기 버전만 봐서 잔재가 수십 개씩 쌓였다.)
                foreach (string dir in Directory.GetDirectories(temp, "B2B_ver*_single_*"))
                {
                    try { Directory.Delete(dir, true); } catch { }
                }
            }
            catch
            {
            }
        }

        private static void CleanupExtract(string dir)
        {
            // 내부 앱(네이티브 호스트)이 막 종료해도 자식(B2B_Server.exe 등) 핸들 해제에 잠깐 시간이 걸려
            // 즉시 삭제가 실패할 수 있다. 짧게 재시도해 종료 직후 폴더가 남지 않게 한다.
            for (int attempt = 0; attempt < 8; attempt++)
            {
                try
                {
                    if (!Directory.Exists(dir)) return;
                    Directory.Delete(dir, true);
                    return;
                }
                catch
                {
                    try { System.Threading.Thread.Sleep(400); } catch { }
                }
            }
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch
            {
            }
        }
    }
}
