import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState<string>(user?.username || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [phone, setPhone] = useState<string>(user?.phone ?? '');
  const [bio, setBio] = useState<string>(user?.bio ?? '');
  const [profileImage, setProfileImage] = useState<string>(user?.profileImage ?? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400');
  const [saving, setSaving] = useState<boolean>(false);

  const handlePickImage = async () => {
    try {
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPerm.status !== 'granted') {
        const msg = 'Permission to access photos was denied';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Permission required', msg);
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (e) {
      console.error('[EditProfile] pick image error', e);
      const msg = 'Failed to pick image. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleTakePhoto = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== 'granted') {
        const msg = 'Permission to use camera was denied';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Permission required', msg);
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (e) {
      console.error('[EditProfile] take photo error', e);
      const msg = 'Failed to take photo. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleCameraPress = () => {
    if (Platform.OS === 'web') {
      const useCamera = typeof window !== 'undefined' ? window.confirm('Use camera? Press Cancel to pick from library.') : false;
      if (useCamera) {
        handleTakePhoto();
      } else {
        handlePickImage();
      }
      return;
    }
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => handleTakePhoto() },
      { text: 'Choose from Library', onPress: () => handlePickImage() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({ username, email, phone, bio, profileImage });
      const msg = 'Profile updated successfully!';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Success', msg);
      }
    } catch (e) {
      console.error('[EditProfile] save error', e);
      const msg = 'Failed to save changes. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: profileImage }}
              style={styles.avatar}
            />
            <TouchableOpacity testID="camera-button" style={styles.cameraButton} onPress={handleCameraPress}>
              <Ionicons name="camera" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                testID="input-username"
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="input-email"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                testID="input-phone"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                testID="input-bio"
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>

            <TouchableOpacity testID="save-button" style={[styles.saveButton, saving ? { opacity: 0.7 } : null]} onPress={handleSave} disabled={saving}>
              <Ionicons name="save" size={20} color={Colors.white} />
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: Colors.gradient.green,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  input: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.gray[900],
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  saveButton: {
    backgroundColor: Colors.gradient.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
