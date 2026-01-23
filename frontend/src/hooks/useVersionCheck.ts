'use client';

import { useEffect, useCallback, useRef } from 'react';

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || '';
const CHECK_INTERVAL = 60 * 1000;

export function useVersionCheck() {
  const lastBuildId = useRef<string>(BUILD_ID);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/_next/static/version.json?' + Date.now(), {
        cache: 'no-store',
      });
      if (!res.ok) return;
      
      const data = await res.json();
      const serverBuildId = data.buildId;
      
      if (lastBuildId.current && serverBuildId && lastBuildId.current !== serverBuildId) {
        if (confirm('检测到新版本，是否刷新页面以获取最新内容？')) {
          window.location.reload();
        }
      }
      lastBuildId.current = serverBuildId;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(checkVersion, CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, [checkVersion]);
}
