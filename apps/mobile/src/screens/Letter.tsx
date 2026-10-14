import { useEffect } from 'react';
import { useStore } from '../store';

// The Letter Home belongs to chapter 8, which Release 1 does not play (docs/RELEASE_1.md): nothing links here, and a stray route goes
// back to the street instead of showing an empty screen. The screen returns with the chapter.
export function Letter() {
  const go = useStore((s) => s.go);
  useEffect(() => go('world'), [go]);
  return null;
}
