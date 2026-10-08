import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopAppRoot = path.resolve(__dirname, '..');
const distDir = path.join(desktopAppRoot, 'dist');
fs.mkdirSync(distDir, { recursive: true });

// 1. Build or ensure SynAI.ico exists
const icoPath = path.join(distDir, 'SynAI.ico');
if (!fs.existsSync(icoPath)) {
  const pngPath = path.resolve(desktopAppRoot, '../../packages/web/public/logo-mark-cyan.png');
  if (fs.existsSync(pngPath)) {
    const pngBuf = fs.readFileSync(pngPath);
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // Type: 1 = ICO
    icoHeader.writeUInt16LE(1, 4); // Count: 1 image

    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(0, 0); // Width (256)
    dirEntry.writeUInt8(0, 1); // Height (256)
    dirEntry.writeUInt8(0, 2); // Color count
    dirEntry.writeUInt8(0, 3); // Reserved
    dirEntry.writeUInt16LE(1, 4); // Color planes
    dirEntry.writeUInt16LE(32, 6); // Bits per pixel
    dirEntry.writeUInt32LE(pngBuf.length, 8); // Size of image data
    dirEntry.writeUInt32LE(22, 12); // Offset of image data (6 + 16)

    const icoBuf = Buffer.concat([icoHeader, dirEntry, pngBuf]);
    fs.writeFileSync(icoPath, icoBuf);
    console.log('[build-desktop-exe] Generated SynAI.ico');
  }
}

// 2. Ensure WebView2 DLLs are present in dist
const requiredDlls = [
  'Microsoft.Web.WebView2.Core.dll',
  'Microsoft.Web.WebView2.WinForms.dll',
  'WebView2Loader.dll'
];

const missingDlls = requiredDlls.filter(dll => !fs.existsSync(path.join(distDir, dll)));
if (missingDlls.length > 0) {
  console.log(`[build-desktop-exe] Downloading missing WebView2 DLLs (${missingDlls.join(', ')})...`);
  const zipPath = path.join(distDir, 'webview2.zip');
  execFileSync('curl.exe', ['-L', 'https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2', '-o', zipPath], { stdio: 'inherit' });
  execFileSync('tar.exe', ['-xf', zipPath, '-C', distDir, '--strip-components=2', 'lib/net462/Microsoft.Web.WebView2.Core.dll', 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'], { stdio: 'inherit' });
  execFileSync('tar.exe', ['-xf', zipPath, '-C', distDir, '--strip-components=3', 'runtimes/win-x64/native/WebView2Loader.dll'], { stdio: 'inherit' });
  try { fs.unlinkSync(zipPath); } catch {}
  console.log('[build-desktop-exe] WebView2 DLLs ready.');
}

const runtimesNative = path.join(distDir, 'runtimes', 'win-x64', 'native');
fs.mkdirSync(runtimesNative, { recursive: true });
fs.copyFileSync(path.join(distDir, 'WebView2Loader.dll'), path.join(runtimesNative, 'WebView2Loader.dll'));

// 3. Write C# source for SynAI native window
const csCode = `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SynAIDesktop {
    static class Program {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        private static Process sidecarProcess = null;
        private static NotifyIcon trayIcon = null;
        private static Form mainForm = null;
        private static WebView2 webView = null;
        private static string appUrl = null;

        [STAThread]
        static void Main(string[] args) {
            try {
                SetCurrentProcessExplicitAppUserModelID("SynAI.DesktopApp");
            } catch {}

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string sidecarPath = Path.Combine(exeDir, "synai-sidecar.exe");
            string webviewDir = Path.Combine(exeDir, "webview");

            if (!File.Exists(sidecarPath)) {
                MessageBox.Show("synai-sidecar.exe bulunamadı:\\n" + exeDir, "SynAI", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Create main window
            mainForm = new Form();
            mainForm.Text = "SynAI";
            mainForm.Name = "SynAI";
            mainForm.Size = new Size(1500, 980);
            mainForm.MinimumSize = new Size(960, 640);
            mainForm.StartPosition = FormStartPosition.CenterScreen;
            mainForm.BackColor = Color.FromArgb(7, 9, 14);

            // Icon
            Icon appIcon = null;
            string ico = Path.Combine(exeDir, "SynAI.ico");
            if (File.Exists(ico)) {
                try { appIcon = new Icon(ico); } catch {}
            }
            if (appIcon == null) {
                try { appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch {}
            }
            if (appIcon != null) {
                mainForm.Icon = appIcon;
            }

            // WebView2
            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            webView.DefaultBackgroundColor = Color.FromArgb(7, 9, 14);
            mainForm.Controls.Add(webView);

            // Tray Icon
            trayIcon = new NotifyIcon();
            if (appIcon != null) {
                trayIcon.Icon = appIcon;
            }
            trayIcon.Text = "SynAI";
            trayIcon.Visible = true;

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("SynAI'ı Aç", (s, e) => ShowMainWindow());
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("Çıkış", (s, e) => ShutdownAndExit());
            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => ShowMainWindow();

            mainForm.FormClosed += (s, e) => {
                ShutdownAndExit();
            };

            // Form Shown: asynchronously boot sidecar and initialize WebView2
            mainForm.Shown += async (s, e) => {
                await StartSidecarAndInitWebView(sidecarPath, webviewDir);
            };

            Application.Run(mainForm);
        }

        private static async Task StartSidecarAndInitWebView(string sidecarPath, string webviewDir) {
            try {
                // Initialize WebView2 environment first
                string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SynAI", "WebView2Profile");
                Directory.CreateDirectory(profileDir);
                var env = await CoreWebView2Environment.CreateAsync(null, profileDir);
                await webView.EnsureCoreWebView2Async(env);
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

                // Start sidecar process
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = sidecarPath;
                psi.WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                if (Directory.Exists(webviewDir)) {
                    psi.EnvironmentVariables["SYNAI_WEBVIEW_DIR"] = webviewDir;
                }

                sidecarProcess = new Process();
                sidecarProcess.StartInfo = psi;

                TaskCompletionSource<string> readyTcs = new TaskCompletionSource<string>();

                sidecarProcess.OutputDataReceived += (sender, args) => {
                    if (!string.IsNullOrEmpty(args.Data)) {
                        if (args.Data.Contains("\\"type\\":\\"ready\\"")) {
                            Match m = Regex.Match(args.Data, "\\"endpoint\\":\\"(http[^\\"]+)\\"");
                            if (m.Success) {
                                readyTcs.TrySetResult(m.Groups[1].Value);
                            }
                        }
                    }
                };

                sidecarProcess.Start();
                sidecarProcess.BeginOutputReadLine();
                sidecarProcess.BeginErrorReadLine();

                // Wait up to 10 seconds for sidecar endpoint
                var completedTask = await Task.WhenAny(readyTcs.Task, Task.Delay(10000));
                if (completedTask == readyTcs.Task) {
                    appUrl = await readyTcs.Task;
                } else {
                    appUrl = "http://127.0.0.1:3126";
                }

                webView.Source = new Uri(appUrl);
            } catch (Exception ex) {
                MessageBox.Show("SynAI başlatılırken hata oluştu:\\n" + ex.Message, "SynAI", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private static void ShowMainWindow() {
            if (mainForm != null && !mainForm.IsDisposed) {
                if (mainForm.WindowState == FormWindowState.Minimized) {
                    mainForm.WindowState = FormWindowState.Normal;
                }
                mainForm.Show();
                mainForm.BringToFront();
                SetForegroundWindow(mainForm.Handle);
            }
        }

        private static void ShutdownAndExit() {
            try {
                if (trayIcon != null) {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
            } catch {}
            try {
                if (sidecarProcess != null && !sidecarProcess.HasExited) {
                    sidecarProcess.Kill();
                }
            } catch {}
            Environment.Exit(0);
        }
    }
}
`;

const csPath = path.join(distDir, 'SynAI.cs');
fs.writeFileSync(csPath, csCode, 'utf8');

// 4. Compile with csc.exe
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const exePath = path.join(distDir, 'SynAI.exe');

console.log('[build-desktop-exe] Compiling native SynAI.exe...');
execFileSync(cscPath, [
  '/target:winexe',
  '/platform:x64',
  '/out:' + exePath,
  '/win32icon:' + icoPath,
  '/r:' + path.join(distDir, 'Microsoft.Web.WebView2.Core.dll'),
  '/r:' + path.join(distDir, 'Microsoft.Web.WebView2.WinForms.dll'),
  '/r:System.dll',
  '/r:System.Drawing.dll',
  '/r:System.Windows.Forms.dll',
  csPath
], { stdio: 'inherit' });

console.log('[build-desktop-exe] Successfully built native SynAI.exe at:', exePath);
