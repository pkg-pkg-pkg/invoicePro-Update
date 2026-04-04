; InvoicePro Setup Script
; Professional Branded Installer with Real Progress Tracking

[Setup]
; === Basic Information ===
AppName=InvoicePro
AppVersion=1.0.0
AppVerName=InvoicePro 1.0.0
AppPublisher=InvoicePro Software
AppPublisherURL=https://www.mypve.in/invoice-pro
AppSupportURL=https://www.mypve.in/contact
AppUpdatesURL=https://www.mypve.in

; === Architecture ===
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; === Installation Paths ===
DefaultDirName={autopf}\InvoicePro
DefaultGroupName=InvoicePro
OutputDir=output
OutputBaseFilename=InvoiceProInstaller
; SetupIconFile=app\InvoicePro.exe

; === Compression ===
Compression=lzma2/ultra64
SolidCompression=yes
DiskSpanning=no
InternalCompressLevel=ultra

; === UI / Logo ===
; IMPORTANT: Inno Setup only accepts BMP files for wizard images.
; Convert your PNG logo to BMP using Paint or PowerShell:
;   PowerShell: Add-Type -Assembly System.Drawing
;               [System.Drawing.Image]::FromFile("..\public\invoicepro-logo.png").Save("logo_banner.bmp")
;
; invoicepro-logo.png  = 164 x 314 px  (left sidebar image, shown on Welcome/Finish pages)
; invoicepro-logo.png  = 55  x 58  px  (top-right corner image, shown on all other pages)
;
WizardStyle=modern
WizardImageFile=..\public\invoicepro-logo.png
WizardSmallImageFile=..\public\invoicepro-logo.png
DisableWelcomePage=no
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableReadyMemo=yes
DisableFinishedPage=no
AllowNoIcons=yes
AlwaysShowGroupOnReadyPage=yes
AlwaysShowDirOnReadyPage=yes
ShowComponentSizes=yes
ShowTasksTreeLines=yes

; === Permissions ===
PrivilegesRequired=admin
MinVersion=10.0
UsePreviousAppDir=yes
UsePreviousGroup=yes
UsePreviousSetupType=no
UsePreviousTasks=yes
AppendDefaultDirName=yes
AppendDefaultGroupName=yes

; === Branding ===
AppCopyright=Copyright © 2025 InvoicePro Software
AppComments=Professional GST Billing Software
AppContact=support@mypve.in

[Messages]
WelcomeLabel1=Welcome to the InvoicePro Setup Wizard
WelcomeLabel2=This will install InvoicePro on your computer.%n%nInvoicePro is a professional GST billing software designed for modern businesses.%n%nClick Next to continue, or Cancel to exit Setup.
FinishedHeadingLabel=Completing the InvoicePro Setup Wizard
FinishedLabelNoIcons=InvoicePro has been successfully installed on your computer.
FinishedLabel=InvoicePro has been successfully installed on your computer.%n%nClick Finish to close this wizard.

[CustomMessages]
PreparingFiles=Preparing installation files...
InstallingComponents=Installing InvoicePro components...
ConfiguringDatabase=Configuring database settings...
RegisteringComponents=Registering system components...
FinalizingSetup=Finalizing installation...
CreatingShortcuts=Creating program shortcuts...
InstallationComplete=Installation completed successfully!

[Files]
Source: "app\InvoicePro.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "app\config.dll";     DestDir: "{app}"; Flags: ignoreversion
Source: "app\resources\*";    DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\InvoicePro";           Filename: "{app}\InvoicePro.exe"; WorkingDir: "{app}"; IconFilename: "{app}\InvoicePro.exe"; Comment: "Launch InvoicePro GST Billing Software"
Name: "{group}\Uninstall InvoicePro"; Filename: "{uninstallexe}"; Comment: "Remove InvoicePro from your computer"
Name: "{commondesktop}\InvoicePro";   Filename: "{app}\InvoicePro.exe"; WorkingDir: "{app}"; Tasks: desktopicon;     IconFilename: "{app}\InvoicePro.exe"; Comment: "Launch InvoicePro GST Billing Software"
Name: "{commonprograms}\InvoicePro";  Filename: "{app}\InvoicePro.exe"; WorkingDir: "{app}"; Tasks: quicklaunchicon; IconFilename: "{app}\InvoicePro.exe"; Comment: "Launch InvoicePro GST Billing Software"

[Tasks]
Name: "desktopicon";     Description: "Create a desktop shortcut";            GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "quicklaunchicon"; Description: "Create a Quick Launch shortcut";       GroupDescription: "Additional shortcuts:"; Flags: unchecked; OnlyBelowVersion: 6.1
Name: "autolaunch";      Description: "Launch InvoicePro after installation"; GroupDescription: "Additional options:";  Flags: unchecked

[Run]
Filename: "{app}\InvoicePro.exe"; Description: "Launch InvoicePro"; Flags: nowait postinstall skipifsilent; Tasks: autolaunch

[UninstallDelete]
Type: filesandordirs; Name: "{app}\resources"
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\temp"

[Registry]
Root: HKLM; Subkey: "SOFTWARE\InvoicePro"; ValueType: string; ValueName: "InstallPath";     ValueData: "{app}"
Root: HKLM; Subkey: "SOFTWARE\InvoicePro"; ValueType: string; ValueName: "Version";         ValueData: "1.0.0"
Root: HKLM; Subkey: "SOFTWARE\InvoicePro"; ValueType: string; ValueName: "InstallDate";     ValueData: "{code:GetInstallDate}"
Root: HKCU; Subkey: "SOFTWARE\InvoicePro"; ValueType: string; ValueName: "UserInstallPath"; ValueData: "{app}"

[Code]
// ============================================================
// REMOVED: BackgroundPanel  — was covering all wizard controls
// REMOVED: LogoPanel        — was causing grey overlay on welcome page
// Logo is handled natively by WizardImageFile / WizardSmallImageFile
// ============================================================
var
  ProgressLabel:   TNewStaticText;
  StatusLabel:     TNewStaticText;
  PercentageLabel: TNewStaticText;
  WelcomeLabel:    TNewStaticText;
  ProgressPanel:   TPanel;

// === Dynamic install date ===
// FIXED: Uses GetDateTimeString (native Inno) — DecodeDate does not exist in Inno Pascal
function GetInstallDate(Param: String): String;
begin
  Result := GetDateTimeString('yyyy/mm/dd', #0, #0);
end;

// === Windows 10+ 64-bit check ===
function IsCompatibleSystem(): Boolean;
var
  Version: TWindowsVersion;
begin
  GetWindowsVersionEx(Version);
  Result := (Version.Major >= 10) and Is64BitInstallMode;
end;

// === Wizard UI setup ===
procedure InitializeWizard();
begin
  WizardForm.Caption := 'InvoicePro Installation';

  // -- Installing page: subtle panel behind progress controls --
  ProgressPanel := TPanel.Create(WizardForm);
  ProgressPanel.Parent := WizardForm.InstallingPage;
  ProgressPanel.Left := 0;
  ProgressPanel.Top := WizardForm.ProgressGauge.Top - 20;
  ProgressPanel.Width := WizardForm.InstallingPage.ClientWidth;
  ProgressPanel.Height := 100;
  ProgressPanel.BevelOuter := bvNone;
  ProgressPanel.ParentBackground := True;

  // -- Progress label: left side above bar --
  ProgressLabel := TNewStaticText.Create(WizardForm);
  ProgressLabel.Parent := WizardForm.InstallingPage;
  ProgressLabel.Top := WizardForm.ProgressGauge.Top + 30;
  ProgressLabel.Left := WizardForm.ProgressGauge.Left;
  ProgressLabel.Width := WizardForm.ProgressGauge.Width - 55;
  ProgressLabel.Caption := CustomMessage('PreparingFiles');
  ProgressLabel.Font.Style := [fsBold];

  // -- Status label: below bar --
  StatusLabel := TNewStaticText.Create(WizardForm);
  StatusLabel.Parent := WizardForm.InstallingPage;
  StatusLabel.Top := WizardForm.ProgressGauge.Top + 50;
  StatusLabel.Left := WizardForm.ProgressGauge.Left;
  StatusLabel.Width := WizardForm.ProgressGauge.Width;
  StatusLabel.Caption := 'Please wait while setup installs InvoicePro...';

  // -- Percentage label: right side above bar --
  PercentageLabel := TNewStaticText.Create(WizardForm);
  PercentageLabel.Parent := WizardForm.InstallingPage;
  PercentageLabel.Top := WizardForm.ProgressGauge.Top + 30;
  PercentageLabel.Left := WizardForm.ProgressGauge.Left + WizardForm.ProgressGauge.Width - 50;
  PercentageLabel.Width := 50;
  PercentageLabel.Caption := '0%';
  PercentageLabel.Font.Style := [fsBold];

  // -- Welcome page: branded tagline at bottom --
  WelcomeLabel := TNewStaticText.Create(WizardForm);
  WelcomeLabel.Parent := WizardForm.WelcomePage;
  WelcomeLabel.Left := 20;
  WelcomeLabel.Width := WizardForm.WelcomePage.ClientWidth - 40;
  WelcomeLabel.Top := WizardForm.WelcomePage.ClientHeight - 75;
  WelcomeLabel.Caption :=
    'InvoicePro — Professional GST Billing Software' + #13#10 +
    'Modern, efficient, and easy to use billing solution for your business.';
  WelcomeLabel.Font.Size := 9;
  WelcomeLabel.Font.Style := [fsBold];
  WelcomeLabel.Font.Color := $0027AE60;
  WelcomeLabel.WordWrap := True;
end;

// === Real-time progress updates ===
procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
var
  Percentage: Integer;
begin
  if MaxProgress > 0 then
    Percentage := Round((CurProgress / MaxProgress) * 100)
  else
    Percentage := 0;

  PercentageLabel.Caption := IntToStr(Percentage) + '%';

  if Percentage < 20 then
    StatusLabel.Caption := CustomMessage('PreparingFiles')
  else if Percentage < 40 then
    StatusLabel.Caption := CustomMessage('InstallingComponents')
  else if Percentage < 60 then
    StatusLabel.Caption := CustomMessage('ConfiguringDatabase')
  else if Percentage < 80 then
    StatusLabel.Caption := CustomMessage('RegisteringComponents')
  else if Percentage < 95 then
    StatusLabel.Caption := CustomMessage('CreatingShortcuts')
  else
    StatusLabel.Caption := CustomMessage('FinalizingSetup');

  WizardForm.InstallingPage.Refresh;
end;

// === Step transitions ===
procedure CurStepChanged(CurStep: TSetupStep);
begin
  case CurStep of
    ssInstall:
      begin
        ProgressLabel.Caption   := 'Installing InvoicePro...';
        StatusLabel.Caption     := CustomMessage('InstallingComponents');
        PercentageLabel.Caption := '0%';
      end;
    ssPostInstall:
      begin
        ProgressLabel.Caption   := CustomMessage('InstallationComplete');
        StatusLabel.Caption     := 'Installation completed successfully!';
        PercentageLabel.Caption := '100%';
      end;
  end;
  WizardForm.Refresh;
end;

// === Finish page branding ===
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedLabel.Font.Size  := 12;
    WizardForm.FinishedLabel.Font.Style := [fsBold];
    WizardForm.FinishedLabel.Font.Color := $0027AE60;
    WizardForm.FinishedLabel.Caption    :=
      'InvoicePro has been successfully installed!' + #13#13 +
      'Thank you for choosing InvoicePro for your business needs.';
  end;
end;

// === Pre-install checks ===
function InitializeSetup(): Boolean;
begin
  Result := False;

  if not Is64BitInstallMode then
  begin
    MsgBox(
      'InvoicePro requires a 64-bit version of Windows.' + #13#10 +
      'Please visit https://www.mypve.in/invoice-pro for the correct version.',
      mbError, MB_OK);
    Exit;
  end;

  if not IsCompatibleSystem then
  begin
    MsgBox(
      'InvoicePro requires Windows 10 (64-bit) or later.' + #13#10 +
      'Please upgrade your operating system and try again.',
      mbError, MB_OK);
    Exit;
  end;

  if not IsAdminLoggedOn then
  begin
    MsgBox(
      'InvoicePro requires administrator privileges.' + #13#10 +
      'Please right-click the installer and select "Run as administrator".',
      mbError, MB_OK);
    Exit;
  end;

  Result := True;
end;

// === Cleanup ===
procedure DeinitializeSetup();
begin
  if Assigned(ProgressPanel)   then ProgressPanel.Free;
  if Assigned(WelcomeLabel)    then WelcomeLabel.Free;
  if Assigned(PercentageLabel) then PercentageLabel.Free;
  if Assigned(StatusLabel)     then StatusLabel.Free;
  if Assigned(ProgressLabel)   then ProgressLabel.Free;
end;
