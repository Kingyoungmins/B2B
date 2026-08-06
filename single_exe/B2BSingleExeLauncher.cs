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
        private const string ResourceName = "payload.zip";

        // [버전 하드코딩 제거 0.7.2.1 / 2026-08-06]
        //   예전엔 여기에 "B2B_ver0.7.2.exe" 가 박혀 있어서, 버전을 올려 빌드하면 겉은 새 버전인데
        //   속은 옛 이름을 찾다가 "Packaged app entry was not found." 로 실행 자체가 죽었다.
        //   빌드는 성공으로 끝나기 때문에 배포 직전까지 아무도 모른다(실측 — 0.7.2.1 빌드에서 발생).
        //   → 이름을 박아두지 말고, 풀어놓은 폴더에서 실행 파일을 직접 찾는다. 버전이 바뀌어도 안 깨진다.
        private const string MainExePattern = "B2B_ver*.exe";
        private const string ExtractPrefix = "B2B_ver_single_";

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
                    ExtractPrefix + Process.GetCurrentProcess().Id + "_" + DateTime.UtcNow.Ticks
                );
                Directory.CreateDirectory(extractDir);

                string payloadZip = Path.Combine(extractDir, "payload.zip");
                ExtractPayloadZip(payloadZip);
                ZipFile.ExtractToDirectory(payloadZip, extractDir);
                TryDelete(payloadZip);

                string mainExe = FindMainExe(extractDir);

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

        /// <summary>
        /// 풀어놓은 폴더에서 실행할 본체 exe 를 찾는다(이름에 버전이 들어가므로 패턴으로 찾는다).
        /// 백엔드(B2B_Server.exe)나 네이티브 호스트는 이름이 달라 걸리지 않는다.
        /// </summary>
        private static string FindMainExe(string extractDir)
        {
            string[] found = Directory.GetFiles(extractDir, MainExePattern, SearchOption.TopDirectoryOnly);
            if (found.Length == 1)
            {
                return found[0];
            }
            if (found.Length == 0)
            {
                // 무엇이 들어있는지 함께 알려준다 — 예전엔 '없다'는 말만 있어 원인 파악이 어려웠다.
                string listing = string.Join(", ", Directory.GetFiles(extractDir, "*.exe", SearchOption.TopDirectoryOnly));
                throw new FileNotFoundException(
                    "Packaged app entry was not found. (pattern: " + MainExePattern
                    + ", exe in package: " + (listing.Length > 0 ? listing : "(none)") + ")",
                    Path.Combine(extractDir, MainExePattern));
            }
            // 여러 개면 가장 최근에 만들어진 것을 쓴다(정상 패키지에는 하나뿐이다).
            Array.Sort(found, delegate (string a, string b)
            {
                return File.GetLastWriteTimeUtc(b).CompareTo(File.GetLastWriteTimeUtc(a));
            });
            return found[0];
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
                // 옛 이름(B2B_ver0.7.2_single_*)과 새 이름(B2B_ver_single_*) 둘 다 지운다 —
                // 예전 버전이 남긴 잔재도 계속 정리되어야 한다.
                foreach (string dir in Directory.GetDirectories(temp, "B2B_ver*single_*"))
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
