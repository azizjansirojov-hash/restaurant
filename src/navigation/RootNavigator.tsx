import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppRealtime } from '../api/realtime';
import { useNotificationListener, usePushRegistration } from '../hooks/useNotifications';
import { useCurrentUser } from '../hooks/useAppData';
import { isSupabaseConfigured } from '../lib/env';
import { useAuth } from '../providers/AuthProvider';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HostScreen } from '../screens/HostScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { KitchenScreen } from '../screens/KitchenScreen';
import { MenuManagerScreen } from '../screens/MenuManagerScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';
import { OTPScreen } from '../screens/OTPScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PromosScreen } from '../screens/PromosScreen';
import { ReserveScreen } from '../screens/ReserveScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { setLastNotification } from '../hooks/useAppData';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { colors } from '../theme/tokens';
import type { GuestStackParamList, OwnerTabParamList, StaffTabParamList } from './types';

const GuestStack = createNativeStackNavigator<GuestStackParamList>();
const StaffTabs = createBottomTabNavigator<StaffTabParamList>();
const OwnerTabs = createBottomTabNavigator<OwnerTabParamList>();

const stackOptions = {
  headerStyle: { backgroundColor: colors.stone },
  headerTintColor: colors.charcoal,
  headerTitleStyle: {
    fontFamily: 'Fraunces_600SemiBold' as const,
    fontSize: 20,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.stone },
  headerBackTitle: '',
};

const tabOptions = {
  headerShown: false as const,
  tabBarActiveTintColor: colors.pomegranate,
  tabBarInactiveTintColor: colors.inkFaint,
  tabBarStyle: {
    backgroundColor: colors.stone,
    borderTopColor: colors.hairline,
    height: 62,
    paddingTop: 6,
  },
  tabBarLabelStyle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.2,
  },
};

function ProfileLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={styles.headerLink}>{t('nav.profile')}</Text>
    </Pressable>
  );
}

function GuestNavigator() {
  const { t } = useTranslation();
  return (
    <GuestStack.Navigator screenOptions={stackOptions}>
      <GuestStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <GuestStack.Screen
        name="Menu"
        component={MenuScreen}
        options={({ navigation }) => ({
          title: t('nav.menu'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => navigation.navigate('Cart')} hitSlop={12}>
                <Text style={styles.headerLink}>{t('nav.cart')}</Text>
              </Pressable>
              <ProfileLink onPress={() => navigation.navigate('Profile')} />
            </View>
          ),
        })}
      />
      <GuestStack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '' }} />
      <GuestStack.Screen name="Cart" component={CartScreen} options={{ title: t('nav.cart') }} />
      <GuestStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t('nav.checkout') }} />
      <GuestStack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: t('nav.order') }} />
      <GuestStack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: t('nav.orders') }} />
      <GuestStack.Screen name="Reserve" component={ReserveScreen} options={{ title: t('nav.reserve') }} />
      <GuestStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: t('nav.profile'),
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('OrderHistory')} hitSlop={12}>
              <Text style={styles.headerLink}>{t('nav.orders')}</Text>
            </Pressable>
          ),
        })}
      />
    </GuestStack.Navigator>
  );
}

function StaffNavigator() {
  const { t } = useTranslation();
  return (
    <StaffTabs.Navigator screenOptions={tabOptions}>
      <StaffTabs.Screen name="Kitchen" component={KitchenScreen} options={{ title: t('nav.kitchen') }} />
      <StaffTabs.Screen name="Host" component={HostScreen} options={{ title: t('nav.host') }} />
    </StaffTabs.Navigator>
  );
}

function OwnerNavigator() {
  const { t } = useTranslation();
  return (
    <OwnerTabs.Navigator screenOptions={tabOptions}>
      <OwnerTabs.Screen name="Kitchen" component={KitchenScreen} options={{ title: t('nav.kitchen') }} />
      <OwnerTabs.Screen name="Host" component={HostScreen} options={{ title: t('nav.host') }} />
      <OwnerTabs.Screen
        name="MenuManager"
        component={MenuManagerScreen}
        options={{ title: t('nav.menuManager') }}
      />
      <OwnerTabs.Screen name="Analytics" component={AnalyticsScreen} options={{ title: t('nav.analytics') }} />
      <OwnerTabs.Screen name="Promos" component={PromosScreen} options={{ title: t('nav.promos') }} />
      <OwnerTabs.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
    </OwnerTabs.Navigator>
  );
}

export function RootNavigator() {
  const { t } = useTranslation();
  const { phase } = useAuth();
  const user = useCurrentUser();
  const localSim = useLocalServerStore((s) => s.sim.currentUser);

  useAppRealtime();
  usePushRegistration();

  const onNotify = useCallback((title: string, body: string) => {
    setLastNotification(title, body);
  }, []);
  useNotificationListener(onNotify);

  const booting =
    phase === 'loading' ||
    (isSupabaseConfigured() && phase === 'signed_in' && !user);

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.pomegranate} />
        <Text style={styles.bootText}>{t('common.appName')}</Text>
      </View>
    );
  }

  const activeUser = user ?? localSim;

  return (
    <NavigationContainer>
      {!activeUser ? (
        <OTPScreen />
      ) : activeUser.role === 'owner' ? (
        <OwnerNavigator />
      ) : activeUser.role === 'staff' ? (
        <StaffNavigator />
      ) : (
        <GuestNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.stone,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootText: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 28,
    color: colors.charcoal,
  },
  headerLink: {
    fontFamily: 'DMSans_500Medium',
    color: colors.pomegranate,
    fontSize: 15,
    paddingHorizontal: 4,
  },
});
