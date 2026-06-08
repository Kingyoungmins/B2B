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
        private const string Version = "0.4.8";
        private const string ResourceName = "payload.zip";
        private const string MainExeName = "B2B_ver0.4.8.exe";

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
                    "B2B_ver0.4.8_single_" + Process.GetCurrentProcess().Id + "_" + DateTime.UtcNow.Ticks
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
                foreach (string dir in Directory.GetDirectories(temp, "B2B_ver0.4.8_single_*"))
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
