import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { listBrews } from '../db/repo';
import { db, type UserBrew } from '../db/schema';
import { calibrationFrom, loadResets, NO_CALIBRATION, type Calibration } from '../domain/calibration';
import { resolveGrinder } from './useBrewSetup';

/** Reset markers, refreshed when a calibration is reset anywhere in the app. */
function useResets(): Record<string, number> {
  const [resets, setResets] = useState(loadResets);
  useEffect(() => {
    const on = () => setResets(loadResets());
    window.addEventListener('baristaLab:calibration', on);
    return () => window.removeEventListener('baristaLab:calibration', on);
  }, []);
  return resets;
}

/** Calibrations for several grinder keys at once, learned from the journal. */
export function useCalibrations(keys: string[]): Record<string, Calibration> {
  const brews = useLiveQuery(() => listBrews(db), []);
  const grinders = useLiveQuery(() => db.grinders.toArray(), []);
  const resets = useResets();
  const keyList = keys.join('|');
  return useMemo(() => {
    const out: Record<string, Calibration> = {};
    const keyOf = (b: UserBrew) => b.grinderKey ?? resolveGrinder(b.setup.grinderId, grinders ?? []).id;
    for (const k of keyList ? keyList.split('|') : []) {
      out[k] = brews?.length ? calibrationFrom(brews, k, { keyOf, resetAt: resets[k] }) : NO_CALIBRATION;
    }
    return out;
  }, [brews, grinders, resets, keyList]);
}

export function useCalibration(key: string): Calibration {
  return useCalibrations([key])[key] ?? NO_CALIBRATION;
}
