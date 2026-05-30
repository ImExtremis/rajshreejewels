import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  // Perform token verification check
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await SecureStore.getItemAsync('admin_token');
        setIsAuthenticated(!!token);
      } catch (err) {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, [segments]); // recheck on segment changes

  // Perform route redirects
  useEffect(() => {
    if (isAuthenticated === null) return;

    const inLogin = segments[0] === 'login';

    if (!isAuthenticated && !inLogin) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inLogin) {
      // Redirect to home if authenticated and trying to access login
      router.replace('/');
    }
  }, [isAuthenticated, segments]);

  // Loading spinner
  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFAF5' }}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#C9A84C',
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: '#FDFAF5' }
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="login" options={{ title: 'Admin Login', headerShown: false }} />
      <Stack.Screen name="new-listing" options={{ title: 'New Listing' }} />
      <Stack.Screen name="preview" options={{ title: 'AI Preview' }} />
      <Stack.Screen name="published" options={{ title: 'Published', headerShown: false }} />
    </Stack>
  );
}
