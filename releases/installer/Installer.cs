using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal static class InstallerProgram
{
    private static readonly string[] ExtensionFiles = {
        "manifest.json",
        "background.js",
        "content.js",
        "popup.html",
        "popup.js",
        "popup.css"
    };

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
    }

    private sealed class InstallerForm : Form
    {
        private readonly TextBox targetBox;
        private readonly Button installButton;
        private readonly Label statusLabel;

        public InstallerForm()
        {
            Text = "PenPOS Luca Veri Setup";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(560, 350);
            MinimumSize = new Size(560, 350);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            BackColor = Color.White;

            var title = new Label {
                Text = "PenPOS Luca Veri",
                Font = new Font("Segoe UI", 20, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 35, 67),
                Location = new Point(32, 28),
                AutoSize = true
            };
            Controls.Add(title);

            var subtitle = new Label {
                Text = "PenPOS ile Luca arasındaki veri bağlantısını sağlar.",
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(80, 96, 120),
                Location = new Point(35, 70),
                AutoSize = true
            };
            Controls.Add(subtitle);

            var welcome = new Label {
                Text = "Hoş geldiniz. Kurulum klasörünü seçin ve Kur düğmesine basın.",
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(45, 58, 79),
                Location = new Point(35, 118),
                AutoSize = true
            };
            Controls.Add(welcome);

            var folderLabel = new Label {
                Text = "Kurulum klasörü:",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(35, 165),
                AutoSize = true
            };
            Controls.Add(folderLabel);

            targetBox = new TextBox {
                Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PenPOS", "Luca Veri"),
                Location = new Point(35, 190),
                Width = 405,
                Font = new Font("Segoe UI", 9)
            };
            Controls.Add(targetBox);

            var browseButton = new Button {
                Text = "Gözat...",
                Location = new Point(450, 188),
                Width = 78,
                Height = 27
            };
            browseButton.Click += BrowseClick;
            Controls.Add(browseButton);

            statusLabel = new Label {
                Text = "",
                ForeColor = Color.FromArgb(40, 110, 75),
                Location = new Point(35, 238),
                Width = 490,
                Height = 35,
                AutoSize = false
            };
            Controls.Add(statusLabel);

            installButton = new Button {
                Text = "Kur",
                BackColor = Color.FromArgb(23, 59, 120),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(425, 290),
                Width = 103,
                Height = 34
            };
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Click += InstallClick;
            Controls.Add(installButton);
        }

        private void BrowseClick(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.SelectedPath = targetBox.Text;
                dialog.Description = "PenPOS Luca Veri kurulum klasörünü seçin.";
                if (dialog.ShowDialog(this) == DialogResult.OK) targetBox.Text = dialog.SelectedPath;
            }
        }

        private void InstallClick(object sender, EventArgs e)
        {
            var targetRoot = targetBox.Text.Trim();
            if (targetRoot.Length == 0) {
                MessageBox.Show(this, "Kurulum klasörü seçin.", "PenPOS Luca Veri", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                installButton.Enabled = false;
                var extensionRoot = Path.Combine(targetRoot, "chrome-extension");
                Directory.CreateDirectory(extensionRoot);
                foreach (var file in ExtensionFiles)
                {
                    using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream(file))
                    {
                        if (input == null) throw new InvalidOperationException("Paket dosyası eksik: " + file);
                        using (var output = File.Create(Path.Combine(extensionRoot, file))) input.CopyTo(output);
                    }
                }

                File.WriteAllText(Path.Combine(targetRoot, "Uninstall-PenPOS-Luca-Veri.ps1"),
                    "$ErrorActionPreference = 'Stop'\r\nRemove-Item -LiteralPath '" + targetRoot.Replace("'", "''") + "' -Recurse -Force\r\nWrite-Host 'PenPOS Luca Veri kaldırıldı.'\r\n", System.Text.Encoding.UTF8);

                statusLabel.Text = "Kurulum tamamlandı.";
                using (var completion = new CompletionForm(extensionRoot))
                {
                    completion.ShowDialog(this);
                }
            }
            catch (Exception error)
            {
                statusLabel.ForeColor = Color.FromArgb(180, 45, 45);
                statusLabel.Text = "Kurulum başarısız.";
                MessageBox.Show(this, error.Message, "PenPOS Luca Veri", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                installButton.Enabled = true;
            }
        }
    }

    private sealed class CompletionForm : Form
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        private readonly string extensionRoot;
        private readonly Label feedbackLabel;

        public CompletionForm(string extensionRoot)
        {
            this.extensionRoot = extensionRoot;
            Text = "PenPOS Luca Veri";
            StartPosition = FormStartPosition.CenterParent;
            ClientSize = new Size(680, 545);
            MinimumSize = new Size(680, 545);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            BackColor = Color.White;

            Controls.Add(new Label {
                Text = "PenPOS Luca Veri",
                Font = new Font("Segoe UI", 20, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 35, 67),
                Location = new Point(34, 28),
                AutoSize = true
            });
            Controls.Add(new Label {
                Text = "Kurulum tamamlandı",
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                ForeColor = Color.FromArgb(40, 135, 82),
                Location = new Point(36, 76),
                AutoSize = true
            });
            Controls.Add(new Label {
                Text = "PenPOS Luca Veri bilgisayarınıza başarıyla kuruldu.",
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(45, 58, 79),
                Location = new Point(36, 112),
                AutoSize = true
            });
            Controls.Add(new Label {
                Text = "Chrome bağlantısını tamamlamak için:",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                ForeColor = Color.FromArgb(45, 58, 79),
                Location = new Point(36, 155),
                AutoSize = true
            });
            Controls.Add(new Label {
                Text = "1. Google Chrome'u açın.\r\n2. Chrome'da Geliştirici modunu açın.\r\n3. \"Paketlenmemiş öğe yükle\" seçeneğine tıklayın.\r\n4. Aşağıdaki klasörü seçin:",
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(45, 58, 79),
                Location = new Point(36, 187),
                AutoSize = true
            });

            var pathBox = new TextBox {
                Text = extensionRoot,
                ReadOnly = true,
                Location = new Point(36, 295),
                Width = 608,
                Height = 28,
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(247, 249, 252)
            };
            Controls.Add(pathBox);

            var copyButton = CreateButton("Klasör Yolunu Kopyala", new Point(36, 338), 190);
            copyButton.Click += delegate {
                try
                {
                    Clipboard.SetText(extensionRoot);
                    feedbackLabel.Text = "✓ Klasör yolu kopyalandı.";
                }
                catch (Exception error)
                {
                    feedbackLabel.Text = "Kopyalama başarısız: " + error.Message;
                }
            };
            Controls.Add(copyButton);

            var chromeButton = CreateButton("Chrome Extensions'ı Aç", new Point(236, 338), 190);
            chromeButton.Click += delegate { OpenChromeExtensions(); };
            Controls.Add(chromeButton);

            var folderButton = CreateButton("Klasörü Aç", new Point(436, 338), 135);
            folderButton.Click += delegate { OpenFolder(); };
            Controls.Add(folderButton);

            feedbackLabel = new Label {
                Text = "",
                ForeColor = Color.FromArgb(40, 110, 75),
                Location = new Point(36, 380),
                Width = 608,
                Height = 24,
                AutoSize = false
            };
            Controls.Add(feedbackLabel);

            var warning = new Label {
                Text = "Not: Chrome güvenlik nedeniyle uzantının bu kurulumunu kullanıcı onayı olmadan gerçekleştiremez. Bir kez \"Paketlenmemiş öğe yükle\" ile klasörü seçmeniz gerekir.",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.FromArgb(145, 85, 18),
                BackColor = Color.FromArgb(255, 247, 226),
                Location = new Point(36, 414),
                Width = 608,
                Height = 54,
                AutoSize = false,
                Padding = new Padding(10, 8, 10, 8)
            };
            Controls.Add(warning);

            var closeButton = CreateButton("Kapat", new Point(541, 490), 103);
            closeButton.Click += delegate { Close(); };
            Controls.Add(closeButton);
            AcceptButton = closeButton;
        }

        private static Button CreateButton(string text, Point location, int width)
        {
            var button = new Button {
                Text = text,
                Location = location,
                Width = width,
                Height = 34,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(23, 59, 120),
                ForeColor = Color.White
            };
            button.FlatAppearance.BorderSize = 0;
            return button;
        }

        private void OpenFolder()
        {
            try
            {
                Process.Start(new ProcessStartInfo {
                    FileName = "explorer.exe",
                    Arguments = "\"" + extensionRoot + "\"",
                    UseShellExecute = false
                });
            }
            catch (Exception error)
            {
                feedbackLabel.Text = "Klasör açılamadı: " + error.Message;
            }
        }

        private void OpenChromeExtensions()
        {
            const string extensionsUrl = "chrome://extensions/";
            var chromePaths = new[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            try
            {
                Process chromeProcess = null;
                foreach (var chromePath in chromePaths)
                {
                    if (!File.Exists(chromePath)) continue;
                    chromeProcess = FindChromeProcess();
                    if (chromeProcess == null)
                    {
                        chromeProcess = Process.Start(new ProcessStartInfo {
                            FileName = chromePath,
                            UseShellExecute = false
                        });
                    }
                    break;
                }

                if (chromeProcess == null && !TryOpenWithDefaultBrowser(extensionsUrl))
                {
                    ShowChromeOpenError();
                    return;
                }

                var chromeWindow = WaitForChromeWindow(10000);
                if (chromeWindow == IntPtr.Zero || !SetForegroundWindow(chromeWindow))
                {
                    ShowChromeOpenError();
                    return;
                }

                Thread.Sleep(250);
                SendKeys.SendWait("^t");
                SendKeys.SendWait("^l");
                SendKeys.SendWait(extensionsUrl);
                SendKeys.SendWait("{ENTER}");
                feedbackLabel.Text = "Chrome Extensions sayfası açıldı.";
            }
            catch
            {
                feedbackLabel.Text = "Chrome Extensions sayfası açılamadı. Lütfen Chrome'u açıp chrome://extensions/ adresine gidin.";
            }
        }

        private static Process FindChromeProcess()
        {
            var processes = Process.GetProcessesByName("chrome");
            if (processes.Length == 0) return null;
            var firstProcess = processes[0];
            for (var index = 1; index < processes.Length; index++)
            {
                processes[index].Dispose();
            }
            return firstProcess;
        }

        private static IntPtr WaitForChromeWindow(int timeoutMilliseconds)
        {
            var elapsed = 0;
            while (elapsed < timeoutMilliseconds)
            {
                var process = FindChromeProcess();
                if (process != null)
                {
                    var handle = process.MainWindowHandle;
                    process.Dispose();
                    if (handle != IntPtr.Zero) return handle;
                }
                Thread.Sleep(100);
                elapsed += 100;
            }
            return IntPtr.Zero;
        }

        private static bool TryOpenWithDefaultBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo {
                    FileName = url,
                    UseShellExecute = true
                });
                return true;
            }
            catch
            {
                return false;
            }
        }

        private void ShowChromeOpenError()
        {
            feedbackLabel.Text = "Chrome Extensions sayfası açılamadı. Lütfen Chrome'u açıp chrome://extensions/ adresine gidin.";
        }
    }
}
