// TestPushNotificationScreen.tsx
// Add this screen temporarily to test push notifications
// You can navigate to it from your ProfileScreen or any other screen

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { registerForPushNotificationsAsync, savePushTokenToUser } from '../../hooks/useRegisterPushToken';

export default function TestPushNotificationScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load saved token from Firestore
  useEffect(() => {
    loadSavedToken();
  }, []);

  const loadSavedToken = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const tokens = userDoc.data()?.expoPushTokens || [];
        if (tokens.length > 0) {
          setSavedToken(tokens[0]);
        }
      }
    } catch (error: any) {
      console.error('Error loading token:', error);
    }
  };

  const handleRegisterToken = async () => {
    setLoading(true);
    try {
      console.log('🔄 Registering push token...');
      const newToken = await registerForPushNotificationsAsync();
      if (newToken) {
        setToken(newToken);
        await savePushTokenToUser(newToken);
        await loadSavedToken();
        Alert.alert('Success', 'Token registered and saved!');
      } else {
        Alert.alert('Error', 'Failed to get push token. Check console logs.');
      }
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error.message || 'Failed to register token');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = (tokenToCopy: string) => {
    // You can use expo-clipboard here if available
    Alert.alert('Token', tokenToCopy, [
      { text: 'Copy', onPress: () => console.log('Token:', tokenToCopy) },
      { text: 'OK' },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Push Notification Test</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step 1: Register Token</Text>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegisterToken}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Registering...' : 'Register Push Token'}
          </Text>
        </TouchableOpacity>
        {token && (
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>New Token:</Text>
            <Text style={styles.token} selectable>
              {token}
            </Text>
            <TouchableOpacity onPress={() => copyToken(token)}>
              <Text style={styles.copyButton}>Copy</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step 2: Check Saved Token</Text>
        {savedToken ? (
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>Saved in Firestore:</Text>
            <Text style={styles.token} selectable>
              {savedToken}
            </Text>
            <TouchableOpacity onPress={() => copyToken(savedToken)}>
              <Text style={styles.copyButton}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noToken}>No token saved in Firestore</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={loadSavedToken}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step 3: Test Notification</Text>
        <Text style={styles.instructions}>
          1. Copy your token above{'\n'}
          2. Go to:{'\n'}
          <Text style={styles.link}>expo.dev/notifications</Text>
          {'\n\n'}
          3. Paste token and send a test notification
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Check</Text>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Token Generated:</Text>
          <Text style={[styles.statusValue, token ? styles.success : styles.error]}>
            {token ? '✅ Yes' : '❌ No'}
          </Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Token Saved:</Text>
          <Text style={[styles.statusValue, savedToken ? styles.success : styles.error]}>
            {savedToken ? '✅ Yes' : '❌ No'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  token: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 10,
  },
  copyButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noToken: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  instructions: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  link: {
    color: '#007AFF',
    fontWeight: '600',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  success: {
    color: '#34C759',
  },
  error: {
    color: '#FF3B30',
  },
});

