; DeepSeek Desktop Client - Inno Setup Script
; 版本: 2.5.1

#define MyAppName "DeepSeek"
#define MyAppVersion "2.5.1"
#define MyAppPublisher "YBMecho"
#define MyAppCopyright "Copyright (C) 2025-2026 YBMecho"
#define MyAppURL "https://github.com/YBMecho/DeepSeek-desktop-client"
#define MyAppExeName "DeepSeek.exe"
#define MyAppIcon "resources\assets\icons\lp25u-mafhn-001.ico"
#define MyAppComments "DeepSeek 网页客户端桌面封装"
#define MyAppDescription "DeepSeek Desktop Client"

[Setup]
AppId={{8E4A3C21-6D9F-4B7A-9C2E-0F5B8A1D4E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppCopyright={#MyAppCopyright}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppComments={#MyAppComments}
DefaultDirName={code:GetDefaultInstallDir}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=out\make\inno-setup
OutputBaseFilename=DeepSeek-{#MyAppVersion}-setup
SetupIconFile={#MyAppIcon}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}
PrivilegesRequired=admin
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppDescription}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "chinesesimp"; MessagesFile: "resources\languages\ChineseSimplified.isl"; LicenseFile: "resources\declarations\ChineseSimplified.txt"
Name: "english"; MessagesFile: "compiler:Default.isl"; LicenseFile: "resources\declarations\English.txt"
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

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
const
  DRIVE_FIXED = 3;
  DRIVE_REMOTE = 4;

{ 检查 D 盘是否可用（存在且为固定/网络磁盘） }
function GetDriveType(lpRootPathName: string): UINT;
  external 'GetDriveTypeW@kernel32.dll stdcall';

{ 获取默认安装目录：D 盘可用时用 D:\DeepSeek，否则回退到 Program Files }
function GetDefaultInstallDir(Param: string): string;
begin
  if (GetDriveType('D:\') = DRIVE_FIXED) or (GetDriveType('D:\') = DRIVE_REMOTE) then
    Result := 'D:\{#MyAppName}'
  else
    Result := ExpandConstant('{autopf}\{#MyAppName}');
end;
