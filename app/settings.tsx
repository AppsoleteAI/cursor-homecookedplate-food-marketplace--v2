import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Globe, Volume2, MapPin, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function SettingsScreen() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleLanguageChange = () => {
    if (Platform.OS === 'web') {
      window.alert('Language selection coming soon');
    } else {
      Alert.alert('Language', 'Language selection coming soon');
    }
  };

  const handleClearCache = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to clear the cache?');
      if (confirmed) {
        window.alert('Cache cleared successfully');
      }
    } else {
      Alert.alert(
        'Clear Cache',
        'Are you sure you want to clear the cache?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => Alert.alert('Success', 'Cache cleared successfully'),
          },
        ]
      );
    }
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


          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
            <TouchableOpacity style={styles.actionItem} onPress={handleLanguageChange}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Globe size={20} color={Colors.gradient.green} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Language</Text>
                  <Text style={styles.settingDescription}>English</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </TouchableOpacity>

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
                onValueChange={setSoundEnabled}
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
                onValueChange={setLocationEnabled}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>
            
            <TouchableOpacity style={styles.actionItem} onPress={handleClearCache}>
              <View style={styles.settingLeft}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Clear Cache</Text>
                  <Text style={styles.settingDescription}>Free up storage space</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
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
});
