; Inno Setup Script for SynAI Desktop Application
; Creates a standard, professional Windows installer (.exe)

#define MyAppName "SynAI"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SynAI Inc."
#define MyAppURL "https://synai.dev"
#define MyAppExeName "SynAI.exe"
#define MyAppIco "..\dist\SynAI.ico"
#define SourceDist "..\dist"

[Setup]
; Unique AppId so Windows recognizes upgrades/uninstallations
AppId={{E6F7A890-C1D2-4E3F-8A5B-9C0D1E2F3A4B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Default destination: Program Files (Admin permissions required, standard Windows app)
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output settings
OutputDir=..\..\..\release
OutputBaseFilename=SynAI-Setup-1.0.0-updated
SetupIconFile={#MyAppIco}
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

Compression=lzma2
SolidCompression=yes

; Privileges: requires Administrator elevation (UAC prompt)
PrivilegesRequired=admin

; Modern wizard appearance
WizardStyle=modern
ShowLanguageDialog=no

; Ask Windows to close SynAI through its normal application shutdown path.
; The app shuts down its sidecar when the main window closes.
CloseApplications=yes
CloseApplicationsFilter=SynAI.exe,synai-sidecar.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "Start SynAI automatically when Windows starts"; GroupDescription: "Additional options:"; Flags: unchecked

[Files]
; Main launcher executable
Source: "{#SourceDist}\SynAI.exe"; DestDir: "{app}"; Flags: ignoreversion
; Bun-compiled backend sidecar
Source: "{#SourceDist}\synai-sidecar.exe"; DestDir: "{app}"; Flags: ignoreversion
; Application icon
Source: "{#SourceDist}\SynAI.ico"; DestDir: "{app}"; Flags: ignoreversion
; Native WebView2 libraries
Source: "{#SourceDist}\Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDist}\Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDist}\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDist}\runtimes\*"; DestDir: "{app}\runtimes"; Flags: ignoreversion recursesubdirs createallsubdirs
; Webview client assets (Next.js export)
Source: "{#SourceDist}\webview\*"; DestDir: "{app}\webview"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu shortcut
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\SynAI.ico"; AppUserModelID: "SynAI.DesktopApp"
; Desktop shortcut (optional task)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\SynAI.ico"; Tasks: desktopicon; AppUserModelID: "SynAI.DesktopApp"
; Auto-start shortcut (optional task)
Name: "{commonstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\SynAI.ico"; Tasks: autostart; AppUserModelID: "SynAI.DesktopApp"

[Run]
; Option to launch SynAI after setup completes
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up runtime-generated caches on uninstall (leave user data intact or clean profile)
Type: filesandordirs; Name: "{app}\webview"
Type: filesandordirs; Name: "{app}\runtimes"
Type: files; Name: "{app}\SynAI.exe"
Type: files; Name: "{app}\synai-sidecar.exe"
Type: files; Name: "{app}\SynAI.ico"
Type: files; Name: "{app}\Microsoft.Web.WebView2.Core.dll"
Type: files; Name: "{app}\Microsoft.Web.WebView2.WinForms.dll"
Type: files; Name: "{app}\WebView2Loader.dll"
