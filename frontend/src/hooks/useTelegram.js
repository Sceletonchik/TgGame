import { useMemo } from 'react';

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  const user = useMemo(() => {
    if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user;
    // Dev fallback
    return {
      id: 123456789,
      first_name: 'Тест',
      last_name: 'Пользователь',
      username: 'testuser',
      photo_url: null,
    };
  }, []);

  return {
    tg,
    user,
    ready:    () => tg?.ready(),
    expand:   () => tg?.expand(),
    close:    () => tg?.close(),
    haptic:   (type = 'light') => tg?.HapticFeedback?.impactOccurred(type),
    vibrate:  () => tg?.HapticFeedback?.notificationOccurred('success'),
    themeParams: tg?.themeParams || {},
  };
}
