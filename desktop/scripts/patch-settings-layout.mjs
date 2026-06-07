/**
 * Patch Settings.tsx with enterprise shell layout.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '../src/pages/Settings.tsx');
let src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (src.includes('SettingsShell')) {
  console.log('Already patched.');
  process.exit(0);
}

const addImports = () => {
  src = src.replace(
    "import { getSessionSettings, setSessionSettings } from '../services/sessionManager';",
    `import { getSessionSettings, setSessionSettings } from '../services/sessionManager';
import SettingsShell, { SettingsSectionBlock } from '../components/settings/SettingsShell';
import type { SettingsSectionId } from '../components/settings/settingsNavConfig';`
  );
};

const patchState = () => {
  src = src.replace(
    'const [activeTab, setActiveTab] = useState<number>(0);',
    "const [activeSection, setActiveSection] = useState<SettingsSectionId>('company');"
  );
  src = src.replace(/setActiveTab\(7\)/g, "setActiveSection('network')");
  src = src.replace(/setActiveTab\(2\)/g, "setActiveSection('about')");
  src = src.replace(/setActiveTab\(9\)/g, "setActiveSection('application')");
  src = src.replace(/setActiveTab\(10\)/g, "setActiveSection('application')");
  src = src.replace(/setActiveTab\(11\)/g, "setActiveSection('company')");
  src = src.replace(/setActiveTab\(12\)/g, "setActiveSection('security')");
  src = src.replace(/setActiveTab\(0\)/g, "setActiveSection('company')");
  src = src.replace(/setActiveTab\(1\)/g, "setActiveSection('application')");
  src = src.replace(/setActiveTab\(3\)/g, "setActiveSection('print')");
  src = src.replace(/setActiveTab\(4\)/g, "setActiveSection('whatsapp')");
  src = src.replace(/setActiveTab\(5\)/g, "setActiveSection('users')");
  src = src.replace(/setActiveTab\(6\)/g, "setActiveSection('security')");
  src = src.replace(/setActiveTab\(8\)/g, "setActiveSection('backup')");
  src = src.replace(/activeTab !== 11/g, "activeSection !== 'company'");
  src = src.replace(/activeTab !== 12/g, "activeSection !== 'security'");
  src = src.replace(/activeTab !== 7/g, "activeSection !== 'network'");
  src = src.replace(/\}, \[activeTab\]\)/g, '}, [activeSection])');
  src = src.replace(
    /\n  const settingsSectionLabels: Record<number, string> = \{[\s\S]*?\};\n/,
    '\n'
  );
};

const patchConditionals = () => {
  const pairs = [
    [0, 'company'],
    [2, 'about'],
    [3, 'print'],
    [4, 'whatsapp'],
    [5, 'users'],
    [7, 'network'],
    [8, 'backup'],
  ];
  for (const [tab, section] of pairs) {
    src = src.replaceAll(`{activeTab === ${tab} &&`, `{activeSection === '${section}' &&`);
  }
  // Security: password (6) + session (12)
  src = src.replace('{activeTab === 6 &&', "{activeSection === 'security' &&");
  src = src.replace('{activeTab === 12 &&', "{activeSection === 'security' && false &&");
  // Application: merge tabs 1, 9, 10
  src = src.replace('{activeTab === 1 &&', "{activeSection === 'application' &&");
  src = src.replace('{activeTab === 9 &&', "{activeSection === 'application' && false &&");
  src = src.replace('{activeTab === 10 &&', "{activeSection === 'application' && false &&");
  // Remove old company desk hub
  src = src.replace('{activeTab === 11 &&', '{false &&');
  src = src.replace('open={activeTab === 11}', "open={activeSection === 'company'}");
};

const appendCompanyDesk = () => {
  const marker = '          {licenseError && (\n            <Alert severity="error" sx={{ mx: 4, mb: 4, borderRadius: 3 }}>\n              {licenseError}\n            </Alert>\n          )}\n        </Box>\n      )}';

  const desk = `{licenseError && (
            <Alert severity="error" sx={{ mx: 4, mb: 4, borderRadius: 3 }}>
              {licenseError}
            </Alert>
          )}

          <Divider sx={{ my: 4, mx: 4 }} />
          <Box sx={{ px: 4, pb: 4 }}>
            <SettingsSectionBlock title="Company Operations" subtitle="Create, switch, or set the default company.">
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Button variant="contained" onClick={() => setCreateCompanyOpen(true)}>
                  Create New Company (Alt+Shift+N)
                </Button>
                <Button variant="outlined" onClick={() => setSwitchCompanyOpen(true)}>
                  Switch Company
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    void (async () => {
                      try {
                        const id = getActiveCompanyId();
                        await setDefaultCompany(id);
                        setDeskHint(\`\${id} is now the default company when you open the app.\`);
                      } catch (e: unknown) {
                        setDeskHint(String((e as Error)?.message ?? 'Failed to set default company'));
                      }
                    })();
                  }}
                >
                  Set Current as Default
                </Button>
              </Stack>
            </SettingsSectionBlock>
            <SettingsSectionBlock title="Your Companies">
              <Alert severity="info" sx={{ mb: 2 }}>
                {deskHint} Open a company, set default, or use <strong>Delete Company</strong> on each card.
              </Alert>
              <CompanySelectScreen mode="embedded" open={activeSection === 'company'} />
            </SettingsSectionBlock>
          </Box>
        </Box>
      )}`;

  if (!src.includes(marker)) {
    throw new Error('Company profile end marker not found');
  }
  src = src.replace(marker, desk);
};

const mergeApplication = () => {
  // Wrap navigation in section block
  src = src.replace(
    `{activeSection === 'application' && (
        <NavigationCustomization />
      )}`,
    `{activeSection === 'application' && (
        <Box>
          <SettingsSectionBlock title="Navigation" subtitle="Shortcuts, menu access, and landing preferences.">
            <NavigationCustomization />
          </SettingsSectionBlock>
          <Divider sx={{ my: 3 }} />
          <SettingsSectionBlock title="Appearance & Layout" subtitle="Theme, accent colour, and invoice templates.">
            <Grid container spacing={3}>
              <AppearanceSettingsSection />
              <Grid item xs={12}>
                <Paper sx={{ p: 3, bgcolor: 'var(--bg-card)', borderRadius: '16px' }}>
                  <InvoiceTemplateSelector showSaveButton />
                </Paper>
              </Grid>
            </Grid>
          </SettingsSectionBlock>
          <Divider sx={{ my: 3 }} />
          <SettingsSectionBlock title="Financial Year & App Settings" subtitle="FY limits, module toggles, and invoice numbering.">`
  );

  // Append session to security after password form
  const secMarker = `{activeSection === 'security' && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Change Password
            </Typography>
            <PasswordChangeForm />
          </Box>
        )}`;

  const secMerged = `{activeSection === 'security' && (
          <Box>
            <SettingsSectionBlock title="Change Password">
              <PasswordChangeForm />
            </SettingsSectionBlock>
            <Divider sx={{ my: 3 }} />
            <SettingsSectionBlock title="Session & Login" subtitle="Control how long you stay signed in on this PC.">
              <Paper sx={{ p: 3, border: '1px solid var(--border)', maxWidth: 480 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Default session (days)"
                    type="number"
                    size="small"
                    value={sessionDaysDefault}
                    onChange={(e) => setSessionDaysDefault(Number(e.target.value) || 7)}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Used when Remember me is off (default 7 days)"
                  />
                  <TextField
                    label="Remember me session (days)"
                    type="number"
                    size="small"
                    value={sessionDaysRemember}
                    onChange={(e) => setSessionDaysRemember(Number(e.target.value) || 30)}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Used when Remember me is checked on login (default 30 days)"
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      void setSessionSettings({
                        sessionDaysDefault,
                        sessionDaysRemember,
                      }).then(() => setSessionSettingsSaved(true));
                    }}
                  >
                    Save security settings
                  </Button>
                  {sessionSettingsSaved && (
                    <Alert severity="success" onClose={() => setSessionSettingsSaved(false)}>
                      Session settings saved.
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </SettingsSectionBlock>
          </Box>
        )}`;

  src = src.replace(secMarker, secMerged);

  // Close application section: find tab 10 end and add closing tags
  const appEnd = `            </Grid>
          </Box>
        )}

        {false &&`;
  const appEndFixed = `            </Grid>
          </SettingsSectionBlock>
        </Box>
      )}

        {false &&`;
  src = src.replace(appEnd, appEndFixed);
};

const patchShell = () => {
  src = src.replace(
    '  return (\n    <Box sx={{ p: 1.5, maxWidth: 1320, mx: \'auto\', bgcolor: \'var(--bg-section)\', borderRadius: \'14px\', transition: \'all 0.2s ease\' }}>',
    `  const currentUserLabel = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return String(u.fullName || u.username || u.email || '—');
    } catch {
      return '—';
    }
  })();

  return (
    <>
      <SettingsShell
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        companySnapshot={{
          name: companyProfile.name,
          gstin: companyProfile.gstin,
          statePin: companyProfile.statePin,
          currentUser: currentUserLabel,
        }}
        onEditCompany={handleEdit}
        onBackupNow={() => setActiveSection('backup')}
        onRestore={() => setActiveSection('backup')}
        onAddUser={() => setActiveSection('users')}
        canBackup={canBackup}
        canRestore={canRestore}
        canManageUsers={canManageUsers}
      >
    <Box sx={{ mt: 0 }}>`
  );

  src = src.replace(
    /\n      <Box sx={{ mb: 1\.5 }}>[\s\S]*?<\/Paper>\n\n/,
    '\n'
  );

  src = src.replace(
    '      <CreateCompanyDialog open={createCompanyOpen}',
    '      </SettingsShell>\n      <CreateCompanyDialog open={createCompanyOpen}'
  );

  src = src.replace('\n    </Box>\n  );\n}', '\n    </>\n  );\n}');
};

addImports();
patchState();
patchConditionals();
appendCompanyDesk();
mergeApplication();
patchShell();

fs.writeFileSync(file, src.replace(/\n/g, '\r\n'));
console.log('Settings.tsx patched successfully.');
