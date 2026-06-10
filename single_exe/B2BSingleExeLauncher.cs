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
        private const string Version = "0.5.2";
        private const string ResourceName = "payload.zip";
        private const string ExtractDirPrefix = "B2B_single_";

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
                    ExtractDirPrefix + Process.GetCurrentProcess().Id + "_" + DateTime.UtcNow.Ticks
                );
                Directory.CreateDirectory(extractDir);

                string payloadZip = Path.Combine(extractDir, "payload.zip");
                ExtractPayloadZip(payloadZip);
                ZipFile.ExtractToDirectory(payloadZip, extractDir);
                TryDelete(payloadZip);

                // 메인 exe 는 버전을 박지 않고 payload 안에서 동적으로 찾는다(B2B_ver*.exe 1개 전제).
                string mainExe = FindMainExe(extractDir);
                if (mainExe == null)
                {
                    throw new FileNotFoundException("Packaged app entry (B2B_ver*.exe) was not found in payload.", extractDir);
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

        private static string FindMainExe(string extractDir)
        {
            try
            {
                string wrapperName = Path.GetFileName(Assembly.GetExecutingAssembly().Location);
                string[] candidates = Directory.GetFiles(extractDir, "B2B_ver*.exe", SearchOption.TopDirectoryOnly);
                foreach (string candidate in candidates)
                {
                    string name = Path.GetFileName(candidate);
                    // wrapper 자신/서버 exe 제외, 네이티브 호스트 본체만.
                    if (String.Equals(name, wrapperName, StringComparison.OrdinalIgnoreCase)) continue;
                    if (name.IndexOf("_single", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    if (String.Equals(name, "B2B_Server.exe", StringComparison.OrdinalIgnoreCase)) continue;
                    return candidate;
                }
            }
            catch
            {
            }
            return null;
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
                foreach (string dir in Directory.GetDirectories(temp, ExtractDirPrefix + "*"))
                {
                    try
                    {
                        DirectoryInfo info = new DirectoryInfo(dir);
                        if (DateTime.UtcNow - info.LastWriteTimeUtc > TimeSpan.FromDays(1))
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
        }

        private static void CleanupExtract(string dir)
        {
            try
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
            }
            catch
            {
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
