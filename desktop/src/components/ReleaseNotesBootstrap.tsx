import { useEffect, useRef, useState } from 'react';
import { getBundledReleaseNotes } from '../constants/bundledReleaseNotes';
import { resolveAppVersion } from '../services/appUpdateService';
import {
  acknowledgeReleaseNotesVersion,
  migrateReleaseNotesAckIfNeeded,
  shouldShowReleaseNotesForVersion,
} from '../services/releaseNotesAckService';
import ReleaseNotesDialog from './ReleaseNotesDialog';

/** Shows bundled release notes once per installed app version after update. */
export default function ReleaseNotesBootstrap() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const appVersion = await resolveAppVersion();
        await migrateReleaseNotesAckIfNeeded(appVersion);
        const bundled = getBundledReleaseNotes(appVersion);
        if (!bundled || cancelled) return;

        const shouldShow = await shouldShowReleaseNotesForVersion(appVersion);
        if (!shouldShow || cancelled) return;

        setVersion(appVersion);
        setNotes(bundled);
        setOpen(true);
      } catch (err) {
        console.warn('[release-notes] startup check failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAcknowledge = () => {
    void acknowledgeReleaseNotesVersion(version).finally(() => {
      setOpen(false);
    });
  };

  return (
    <ReleaseNotesDialog
      open={open}
      version={version}
      notes={notes}
      onAcknowledge={handleAcknowledge}
    />
  );
}
