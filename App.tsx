// App.tsx
import React, { useEffect, useRef } from "react";
import "react-native-gesture-handler";
import { Platform, View, ActivityIndicator } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from "./AuthContext";
import { ThemeProvider, useTheme } from "./Screens/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

import OnboardingScreen from "./Screens/OnboardingScreen";
import AuthScreen from "./Screens/AuthScreen";
import CommunityScreen from "./Screens/Community/CommunityScreen";
import CommunityDetailScreen from "./Screens/Community/CommunityDetailScreen";
import CreateCommunityScreen from "./Screens/Community/CreateCommunityScreen";
import GroupChatScreen from "./Screens/Community/Group/GroupChatScreen";
import ProfileScreen from "./Screens/Users/ProfileScreen";
import UserProfileScreen from "./Screens/Users/userProfileScreen";
import EditCommunityScreen from "./Screens/Community/EditCommunityScreen";
import ChatRoomScreen from "./Screens/Users/ChatRoomScreen";
import GroupDetailsScreen from "./Screens/Community/Group/GroupDetailsScreen";
import WalletScreen from "./Screens/Wallet/WalletScreen";
import UserScreen from "./Screens/Users/UsersScreen";
import BusinessesScreen from "./Screens/Businesses/BusinessesScreen";
import CreateBusinessScreen from "./Screens/Businesses/CreateBusinessScreen";
import AddCatalogScreen from "./Screens/Businesses/AddCatalogScreen";
import EditBusinessScreen from "./Screens/Businesses/EditBusinessScreen";
import CatalogEditorScreen from "./Screens/Businesses/CatalogEditorScreen";
import BusinessChatScreen from "./Screens/Businesses/BusinessChatScreen";
import MyBusinessScreen from "./Screens/Businesses/MyBusinessScreen";
import CreateGroupChatScreen from "./Screens/Community/Group/CreateGroupChatScreen";
import EhailingScreen from "./Screens/ehailing/EhailingScreen";
import BeADriverScreen from "./Screens/ehailing/BeADriverScreen";
import MapScreen from "./Screens/Map/MapScreen";
import ShopScreen from "./Screens/Businesses/ShopScreen";
import GroupWalletScreen from "./Screens/Community/Group/GroupWalletScreen";
import { registerForPushNotificationsAsync, savePushTokenToUser } from './hooks/useRegisterPushToken';
import { LogBox } from 'react-native';

// Add this line somewhere at the top level of your app
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested'
]);

// Set up notification handler for expo-notifications (for foreground notifications)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: Platform.OS === 'ios',
    shouldShowList: Platform.OS === 'ios',
  }),
});

// Create Android notification channel for foreground notifications
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

// Optional: strongly-typed route names if you keep a RootStackParamList
// type RootStackParamList = { ... }

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Global nav ref so we can navigate from push tap handlers
export const navigationRef = React.createRef<NavigationContainerRef<any>>();

const TabsNavigator = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          position: "absolute",
          bottom: 0,
          height: 65,
          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "ellipse-outline";
          if (route.name === "CommunityScreen") iconName = "people-outline";
          else if (route.name === "BusinessesScreen") iconName = "storefront-outline";
          else if (route.name === "WalletScreen") iconName = "wallet-outline";
          else if (route.name === "UserScreen") iconName = "person-outline";
          else if (route.name === "MapScreen") iconName = "map-outline";
          return <Ionicons name={iconName} size={size + 4} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CommunityScreen" component={CommunityScreen} />
      <Tab.Screen name="UserScreen" component={UserScreen} />
      <Tab.Screen name="WalletScreen" component={WalletScreen} />
      <Tab.Screen name="BusinessesScreen" component={BusinessesScreen} />
      <Tab.Screen name="MapScreen" component={MapScreen} />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  const { user } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState<boolean | null>(null);

  // Check if user has seen onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const value = await AsyncStorage.getItem("@hasSeenOnboarding");
        setHasSeenOnboarding(value === "true");
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        setHasSeenOnboarding(false);
      }
    };
    checkOnboardingStatus();
  }, []);

  // ----- [ADDED] Handle FCM notifications -----
  useEffect(() => {
    // Handle notification when app is in foreground
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📬 FCM message received in foreground:', remoteMessage);
      
      const data = remoteMessage.data || {};
      const notification = remoteMessage.notification;

      // FCM doesn't automatically display notifications when app is in foreground
      // We need to show them manually using expo-notifications
      if (notification) {
        try {
          console.log('📬 Displaying foreground notification:', notification.title, notification.body);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notification.title || 'Notification',
              body: notification.body || '',
              data: data,
              sound: true,
            },
            trigger: null, // Show immediately
          });
          console.log('✅ Foreground notification scheduled successfully');
        } catch (error: any) {
          console.error('❌ Failed to display foreground notification:', error);
          console.error('Error details:', error.message, error.stack);
        }
      }
    });

    // Handle notification taps from expo-notifications (foreground notifications)
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      console.log('📬 Foreground notification tapped:', data);
      handleNotificationNavigation(data);
    });

    // Handle notification tap when app is in background or quit state
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📬 Notification opened app from background:', remoteMessage);
      const data = remoteMessage.data || {};
      handleNotificationNavigation(data);
    });

    // Check if app was opened from a quit state via notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📬 Notification opened app from quit state:', remoteMessage);
          const data = remoteMessage.data || {};
          // Use a small timeout to ensure the navigator is ready
          setTimeout(() => {
            handleNotificationNavigation(data);
          }, 1000);
        }
      });

    // Handle token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
      console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
      savePushTokenToUser(token);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
      notificationResponseSubscription.remove();
    };
  }, []);

  // Helper function to handle navigation from notification data
  const handleNotificationNavigation = (data: any) => {
    if (data?.type === 'dm' && data.chatId && data.recipientId) {
      if (navigationRef.current) {
        navigationRef.current.navigate('ChatRoomScreen', {
          chatId: data.chatId as string,
          recipientId: data.recipientId as string,
        });
      }
    } else if (data?.type === 'group' && data.communityId && data.chatId) {
      if (navigationRef.current) {
        navigationRef.current.navigate('GroupChatScreen', {
          groupId: data.chatId as string,
          groupName: (data.groupName as string) || 'Group',
          communityId: data.communityId as string,
        });
      }
    }
  };
  // ----- [END ADDED SECTION] -----

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) {
        console.log('⏸️ No user logged in, skipping push token registration');
        return;
      }
      console.log('🔔 Starting push notification registration for user:', user.uid);
      const token = await registerForPushNotificationsAsync();
      if (mounted && token) {
        console.log('💾 Saving token to Firestore...');
        await savePushTokenToUser(token);
      } else if (mounted) {
        console.warn('⚠️ No push token obtained, skipping save');
      }
    })();
    return () => { mounted = false; };
  }, [user]);


  // Show loading while checking onboarding status
  if (hasSeenOnboarding === null) {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
          <ActivityIndicator size="large" color="#9C3FE4" />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator 
          screenOptions={{ headerShown: false }}
          initialRouteName={hasSeenOnboarding ? "AuthScreen" : "OnboardingScreen"}
        >
          {user ? (
            <>
              <RootStack.Screen name="Tabs" component={TabsNavigator} />

              {/* Screens without the bottom tab bar */}
              <RootStack.Screen name="GroupChatScreen" component={GroupChatScreen} />
              <RootStack.Screen name="ChatRoomScreen" component={ChatRoomScreen} />
              <RootStack.Screen name="CommunityDetailScreen" component={CommunityDetailScreen} />
              <RootStack.Screen name="EditCommunityScreen" component={EditCommunityScreen} />
              <RootStack.Screen name="UserProfileScreen" component={UserProfileScreen} />
              <RootStack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />
              <RootStack.Screen name="CreateCommunityScreen" component={CreateCommunityScreen} />
              <RootStack.Screen name="CreateBusinessScreen" component={CreateBusinessScreen} />
              <RootStack.Screen name="AddCatalogScreen" component={AddCatalogScreen} />
              <RootStack.Screen name="EditBusinessScreen" component={EditBusinessScreen} />
              <RootStack.Screen name="CatalogEditorScreen" component={CatalogEditorScreen} />
              <RootStack.Screen name="BusinessChatScreen" component={BusinessChatScreen} />
              <RootStack.Screen name="MyBusinessScreen" component={MyBusinessScreen} />
              <RootStack.Screen name="CreateGroupChatScreen" component={CreateGroupChatScreen} />
              <RootStack.Screen name="BeADriverScreen" component={BeADriverScreen} />
              <RootStack.Screen name="ProfileScreen" component={ProfileScreen} />
              <RootStack.Screen name="ShopScreen" component={ShopScreen} />
              <RootStack.Screen name="GroupWalletScreen" component={GroupWalletScreen} />

            </>
          ) : (
            <>
              {/* Always register both screens for unauthenticated users */}
              <RootStack.Screen name="OnboardingScreen" component={OnboardingScreen} />
              <RootStack.Screen name="AuthScreen" component={AuthScreen} />
            </>
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
};

const App = () => (
  <AuthProvider>
    <MainNavigator />
  </AuthProvider>
);

export default App;
