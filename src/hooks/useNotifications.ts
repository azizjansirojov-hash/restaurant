import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useUpdateProfile } from '../api/profile';
import { isSupabaseConfigured } from '../lib/env';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Lale',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

export function usePushRegistration() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    registerForPushNotifications().then((token) => {
      if (token && token !== user.pushToken) {
        updateProfile.mutate({ push_token: token });
      }
    });
  }, [user?.id]);
}

export function useNotificationListener(
  onNotify: (title: string, body: string) => void
) {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      onNotify(n.request.content.title ?? 'Lale', n.request.content.body ?? '');
    });
    return () => sub.remove();
  }, [onNotify]);
}
