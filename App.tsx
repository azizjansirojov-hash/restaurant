import {
  DMSans_400Regular,
  DMSans_500Medium,
  useFonts as useDmSans,
} from '@expo-google-fonts/dm-sans';
import {
  Fraunces_600SemiBold,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initI18n } from './src/i18n';
import { isStripeConfigured } from './src/lib/env';
import { AuthProvider } from './src/providers/AuthProvider';
import { QueryProvider } from './src/providers/QueryProvider';
import { StripeWrapper } from './src/providers/StripeWrapper';
import { colors } from './src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const [i18nReady, setI18nReady] = useState(false);
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold });
  const [dmLoaded] = useDmSans({ DMSans_400Regular, DMSans_500Medium });

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  const ready = frauncesLoaded && dmLoaded && i18nReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  const tree = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.stone }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (isStripeConfigured()) {
    return <StripeWrapper>{tree}</StripeWrapper>;
  }

  return tree;
}

export default function App() {
  return <AppShell />;
}
