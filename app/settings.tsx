import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Globe, Volume2, MapPin, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { GlassPressable } from '@/components/glass-surface';
import { ScreenBack } from '@/components/BackCircle';

const SOUND_KEY = 'settings_sound_enabled';
const LOCATION_KEY = 'settings_location_enabled';

export default function SettingsScreen() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(SOUND_KEY),
      AsyncStorage.getItem(LOCATION_KEY),
    ]).then(([sound, location]) => {
      if (!active) return;
      if (sound === '0' || sound === '1') setSoundEnabled(sound === '1');
      if (location === '0' || location === '1') setLocationEnabled(location === '1');
      setReady(true);
    }).catch(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setSound = (value: boolean) => {
    setSoundEnabled(value);
    AsyncStorage.setItem(SOUND_KEY, value ? '1' : '0').catch(() => undefined);
  };

  const setLocation = (value: boolean) => {
    setLocationEnabled(value);
    AsyncStorage.setItem(LOCATION_KEY, value ? '1' : '0').catch(() => undefined);
  };

  const clearStoredCache = async () => {
    await Image.clearMemoryCache();
    await Image.clearDiskCache();
  };

  const handleClearCache = () => {
    const finish = async () => {
      try {
        await clearStoredCache();
        if (Platform.OS === 'web') window.alert('Cached pictures were cleared.');
        else Alert.alert('Cache', 'Cached pictures were cleared.');
      } catch {
        if (Platform.OS === 'web') window.alert('The picture cache could not be cleared.');
        else Alert.alert('Cache', 'The picture cache could not be cleared.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Clear cached pictures on this device?')) void finish();
      return;
    }
    Alert.alert(
      'Clear Cache',
      'Clear cached pictures on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void finish() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenBack fallback="/(tabs)/profile" testID="settings-back" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Globe size={20} color={Colors.gradient.green} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Language</Text>
                  <Text style={styles.settingDescription}>English is the language in the app.</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Volume2 size={20} color={Colors.gradient.orange} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Sound Effects</Text>
                  <Text style={styles.settingDescription}>Enable app sounds</Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSound}
                disabled={!ready}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <MapPin size={20} color={Colors.gradient.red} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Location Services</Text>
                  <Text style={styles.settingDescription}>Allow location access</Text>
                </View>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocation}
                disabled={!ready}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>
            
            <GlassPressable style={styles.actionItem} onPress={handleClearCache}>
              <View style={styles.settingLeft}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Clear Cache</Text>
                  <Text style={styles.settingDescription}>Clear cached pictures on this device</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </GlassPressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>2025.01.001</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gradient.green + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray[900],
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.gray[600],
    marginTop: 4,
    lineHeight: 18,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.gray[700],
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray[900],
  },
  membershipCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
  },
  membershipHeader: {
    marginBottom: 12,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  membershipBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  subscriptionInfo: {
    marginBottom: 16,
  },
  subscriptionText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gradient.green,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gradient.green,
  },
});
