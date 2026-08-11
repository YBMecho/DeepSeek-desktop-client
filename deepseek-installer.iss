; DeepSeek Desktop Client - Inno Setup Script
; 版本: 2.5.0

#define MyAppName "DeepSeek"
#define MyAppVersion "2.5.0"
#define MyAppPublisher "YBMecho"
#define MyAppExeName "DeepSeek.exe"
#define MyAppIcon "resources\assets\icons\lp25u-mafhn-001.ico"

[Setup]
AppId={{DEEPSEEK-DESKTOP-CLIENT-2.5.0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=out\make\inno-setup
OutputBaseFilename=DeepSeek-2.5.0-setup
SetupIconFile={#MyAppIcon}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "out\DeepSeek-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCR; Subkey: "*\shell\SendToDeepSeek"; ValueType: string; ValueName: ""; ValueData: "发送到 DeepSeek"; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek"; ValueType: string; ValueName: "SubCommands"; ValueData: "dsquick;dsExpert;dsImage"; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsquick"; ValueType: string; ValueName: ""; ValueData: "快速模式"; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsquick\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"" ""--mode=quick"""; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsExpert"; ValueType: string; ValueName: ""; ValueData: "专家模式"; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsExpert\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"" ""--mode=expert"""; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsImage"; ValueType: string; ValueName: ""; ValueData: "识图模式"; Flags: uninsdeletekey
Root: HKCR; Subkey: "*\shell\SendToDeepSeek\shell\dsImage\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"" ""--mode=image"""; Flags: uninsdeletekey

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
