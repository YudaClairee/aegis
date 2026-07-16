import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/env';

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;

    console.log('FCM Device Token:', token);

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (accessToken && token) {
      const response = await fetch(`${API_URL}/api/auth/push-token`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS === 'android' ? 'android' : 'ios',
        }),
      });

      if (!response.ok) {
        console.warn('Failed to upload push token to backend:', response.status);
      } else {
        console.log('Push token successfully registered on backend');
      }
    }

    return token;
  } catch (err) {
    console.error('Error registering for push notifications:', err);
    return null;
  }
}
