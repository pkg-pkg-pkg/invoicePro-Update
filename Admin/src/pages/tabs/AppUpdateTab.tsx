import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';

import {
  defaultWindowsSetupFileName,
  GITHUB_UPDATE_OWNER,
  GITHUB_UPDATE_REPO,
} from '../../constants/githubRelease';
import { db } from '../../firebase/firebase';
import { fetchLatestGitHubRelease } from '../../services/githubReleaseService';

type AppConfigPublic = {
  latestVersion: string;
  minSupportedVersion?: string | null;
  downloadUrl: string;
  releaseNotes?: string;
  mandatory?: boolean;
};

const DOC_PATH = doc(db, 'app_config', 'public');

export default function AppUpdateTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [latestVersion, setLatestVersion] = useState('');
  const [minSupportedVersion, setMinSupportedVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [mandatory, setMandatory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(DOC_PATH);
        const d = (snap.exists() ? (snap.data() as any) : {}) as AppConfigPublic;
        if (cancelled) return;
        setLatestVersion(String(d.latestVersion ?? '').trim());
        setMinSupportedVersion(String(d.minSupportedVersion ?? '').trim());
        setDownloadUrl(String(d.downloadUrl ?? '').trim());
        setReleaseNotes(String(d.releaseNotes ?? ''));
        setMandatory(Boolean(d.mandatory));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? 'Failed to load app_config/public'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchFromGitHub = async (autoSave: boolean) => {
    setFetching(true);
    setError(null);
    setOkMsg(null);
    try {
      const release = await fetchLatestGitHubRelease();
      setLatestVersion(release.version);
      setDownloadUrl(release.downloadUrl);
      setReleaseNotes(release.releaseNotes);
      if (autoSave) {
        await setDoc(
          DOC_PATH,
          {
            latestVersion: release.version,
            downloadUrl: release.downloadUrl,
            releaseNotes: release.releaseNotes,
            minSupportedVersion: minSupportedVersion.trim() || null,
            mandatory: Boolean(mandatory),
            updatedAt: serverTimestamp(),
            source: 'github',
            githubTag: release.tagName,
          },
          { merge: true }
        );
        setOkMsg(`Fetched v${release.version} from GitHub and saved to Firestore.`);
      } else {
        setOkMsg(`Fetched v${release.version} from GitHub. Click Save to publish to desktop apps.`);
      }
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'GitHub fetch failed'));
    } finally {
      setFetching(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      await setDoc(
        DOC_PATH,
        {
          latestVersion: latestVersion.trim(),
          minSupportedVersion: minSupportedVersion.trim() || null,
          downloadUrl: downloadUrl.trim(),
          releaseNotes: releaseNotes,
          mandatory: Boolean(mandatory),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setOkMsg('Saved.');
    } catch (e: any) {
      setError(String(e?.message ?? 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
        App Update Config (Firestore `app_config/public`)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Desktop app reads this for update checks. Source repo:{' '}
        <a
          href={`https://github.com/${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}/releases`}
          target="_blank"
          rel="noreferrer"
        >
          {GITHUB_UPDATE_OWNER}/{GITHUB_UPDATE_REPO}
        </a>
        . Expected installer name: {defaultWindowsSetupFileName('3.4.6')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {okMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {okMsg}
        </Alert>
      )}

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            onClick={() => void fetchFromGitHub(false)}
            disabled={loading || saving || fetching}
          >
            {fetching ? 'Fetching…' : 'Fetch from GitHub'}
          </Button>
          <Button
            variant="contained"
            onClick={() => void fetchFromGitHub(true)}
            disabled={loading || saving || fetching}
          >
            {fetching ? 'Fetching…' : 'Fetch from GitHub & Save'}
          </Button>
        </Stack>

        <TextField
          label="Latest Version"
          value={latestVersion}
          onChange={(e) => setLatestVersion(e.target.value)}
          disabled={loading || saving}
        />
        <TextField
          label="Minimum Supported Version (optional)"
          value={minSupportedVersion}
          onChange={(e) => setMinSupportedVersion(e.target.value)}
          disabled={loading || saving}
        />
        <TextField
          label="Download URL (Installer)"
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          disabled={loading || saving}
          helperText="GitHub release .exe URL — filled automatically on Fetch"
        />
        <TextField
          label="Release Notes"
          value={releaseNotes}
          onChange={(e) => setReleaseNotes(e.target.value)}
          disabled={loading || saving}
          multiline
          minRows={6}
        />

        <Box>
          <label>
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              disabled={loading || saving}
            />{' '}
            Mandatory update (force)
          </label>
        </Box>

        <Box>
          <Button variant="contained" onClick={save} disabled={loading || saving || fetching}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
