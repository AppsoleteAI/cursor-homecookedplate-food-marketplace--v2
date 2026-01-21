import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { cuisineTypes } from '@/mocks/data';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeals } from '@/hooks/meals-context';
import { useAuth } from '@/hooks/auth-context';
import { Video, ResizeMode } from 'expo-av';
import { trpc } from '@/lib/trpc';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

type MediaType = 'image' | 'video';
interface MediaItem {
  uri: string;
  type: MediaType;
  duration?: number;
}

interface FormState {
  name: string;
  category: string;
  price: string;
  ingredientList: string;
  freshnessExpiryDate?: string;
  freshnessReceiptDate?: string;
  media: MediaItem[];
  freshnessMedia: MediaItem[];
  availabilityWindows: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

export default function CreateMealScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>({
    name: '',
    category: '',
    price: '',
    ingredientList: '',
    freshnessExpiryDate: '',
    freshnessReceiptDate: '',
    media: [],
    freshnessMedia: [],
    availabilityWindows: [],
  });
  const { addMeal } = useMeals();
  const [saving, setSaving] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [foodSafetyAcknowledged, setFoodSafetyAcknowledged] = useState<boolean>(false);

  const { requestPlatemakerRole } = useAuth();

  // Show onboarding if user is not a platemaker
  const isPlatemaker = user?.role === 'platemaker';
  const showOnboarding = !authLoading && !isPlatemaker;
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleBecomeSeller = useCallback(async () => {
    try {
      setIsUpgrading(true);
      await requestPlatemakerRole();
      // The AuthContext will update the user state, which will trigger a re-render
      // and automatically switch from onboarding to the meal creation form
      Alert.alert(
        'Success!',
        'You are now a PlateMaker! You can start creating and selling meals.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upgrade account. Please try again later.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpgrading(false);
    }
  }, [requestPlatemakerRole]);

  const onChange = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      const accepted = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (accepted.length === 0) return;

      let added = 0;
      accepted.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const uri = typeof reader.result === 'string' ? reader.result : undefined;
            if (uri) {
              setForm(prev => ({ ...prev, media: [...prev.media, { uri, type: 'image' }] }));
              added += 1;
            }
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
          const objectUrl = URL.createObjectURL(file);
          const videoEl = document.createElement('video');
          videoEl.preload = 'metadata';
          videoEl.src = objectUrl;
          videoEl.onloadedmetadata = () => {
            const duration = Number(videoEl.duration ?? 0);
            if (Number.isFinite(duration) && duration <= 8) {
              setForm(prev => ({ ...prev, media: [...prev.media, { uri: objectUrl, type: 'video', duration }] }));
              added += 1;
            } else {
              Alert.alert('Video too long', 'Please upload a video up to 8 seconds.');
              URL.revokeObjectURL(objectUrl);
            }
          };
        }
      });
      setTimeout(() => {
        if (added > 0) Alert.alert('Upload', `${added} item(s) added`);
      }, 300);
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, []);

  const ensureLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'We need access to your photo library to pick images or videos.');
        return false;
      }
      return true;
    } catch {
      Alert.alert('Error', 'Unable to request media library permission.');
      return false;
    }
  }, []);

  const ensureCapturePermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') return true;
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert('Permission required', 'Camera access is required to record video with audio.');
        return false;
      }
      const confirmMic = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Microphone access',
          'We will use your microphone while recording the video. Do you allow this?',
          [
            { text: 'No', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Yes', style: 'default', onPress: () => resolve(true) },
          ],
          { cancelable: true }
        );
      });
      if (!confirmMic) return false;
      return true;
    } catch {
      Alert.alert('Error', 'Unable to request camera/microphone permissions.');
      return false;
    }
  }, []);

  const pickMedia = useCallback(async () => {
    const hasPerm = await ensureLibraryPermission();
    if (!hasPerm) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const next: MediaItem[] = [];
      result.assets.forEach(a => {
        const type: MediaType = (a.type === 'video' || a.type === 'image') ? a.type : (a.duration ? 'video' : 'image');
        const duration = typeof a.duration === 'number' ? a.duration : undefined;
        if (type === 'video' && typeof duration === 'number' && duration > 8) {
          Alert.alert('Video too long', 'Please select videos up to 8 seconds.');
          return;
        }
        next.push({ uri: a.uri, type, duration });
      });
      setForm(prev => ({ ...prev, media: [...prev.media, ...next] }));
    }
  }, [ensureLibraryPermission]);

  const addAvailabilityWindow = useCallback(() => {
    setForm(prev => ({
      ...prev,
      availabilityWindows: [
        ...prev.availabilityWindows,
        { dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
      ],
    }));
  }, []);

  const updateAvailabilityWindow = useCallback((index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: number | string) => {
    setForm(prev => ({
      ...prev,
      availabilityWindows: prev.availabilityWindows.map((w, i) =>
        i === index ? { ...w, [field]: value } : w
      ),
    }));
  }, []);

  const removeAvailabilityWindow = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      availabilityWindows: prev.availabilityWindows.filter((_, i) => i !== index),
    }));
  }, []);

  const pickFreshnessMedia = useCallback(async () => {
    const hasPerm = await ensureLibraryPermission();
    if (!hasPerm) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const next: MediaItem[] = [];
      result.assets.forEach(a => {
        const type: MediaType = (a.type === 'video' || a.type === 'image') ? a.type : (a.duration ? 'video' : 'image');
        const duration = typeof a.duration === 'number' ? a.duration : undefined;
        if (type === 'video' && typeof duration === 'number' && duration > 8) {
          Alert.alert('Video too long', 'Please select videos up to 8 seconds.');
          return;
        }
        next.push({ uri: a.uri, type, duration });
      });
      setForm(prev => ({ ...prev, freshnessMedia: [...prev.freshnessMedia, ...next] }));
    }
  }, [ensureLibraryPermission]);

  const startCountdown = useCallback(async (seconds: number) => {
    setCountdown(seconds);
    await new Promise<void>(resolve => {
      let remaining = seconds;
      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
    setCountdown(0);
  }, []);

  const captureMedia = useCallback(async () => {
    const ok = await ensureCapturePermissions();
    if (!ok) return;

    await startCountdown(2);

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 8,

      cameraType: 'back' as ImagePicker.CameraType,
    } as any);
    if (!result.canceled) {
      const a = result.assets[0];
      const type: MediaType = a.type === 'video' ? 'video' : (a.type === 'image' ? 'image' : (a.duration ? 'video' : 'image'));
      const duration = typeof a.duration === 'number' ? a.duration : undefined;
      if (type === 'video' && typeof duration === 'number' && duration > 8) {
        Alert.alert('Video too long', 'Please record up to 8 seconds.');
        return;
      }
      setForm(prev => ({ ...prev, media: [...prev.media, { uri: a.uri, type, duration }] }));
    }
  }, [ensureCapturePermissions, startCountdown]);

  const priceNumber = useMemo(() => {
    const n = Number(form.price);
    return Number.isFinite(n) ? n : 0;
  }, [form.price]);

  const isValid = useMemo(() => {
    const hasFreshness = !!(form.freshnessExpiryDate || form.freshnessReceiptDate);
    return (
      form.name.trim().length > 0 &&
      form.category.trim().length > 0 &&
      priceNumber > 0 &&
      form.ingredientList.trim().length > 0 &&
      hasFreshness &&
      form.media.length > 0 &&
      foodSafetyAcknowledged
    );
  }, [form, priceNumber, foodSafetyAcknowledged]);

  // Set acknowledgment to true if user has already acknowledged in their profile
  useEffect(() => {
    if (user?.foodSafetyAcknowledged) {
      setFoodSafetyAcknowledged(true);
    }
  }, [user?.foodSafetyAcknowledged]);

  const saveMeal = useCallback(async () => {
    if (!isValid) return;
    try {
      setSaving(true);
      await new Promise(resolve => setTimeout(resolve, 600));
      await addMeal({
        ownerId: user?.id ?? 'unknown',
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(priceNumber),
        ingredients: form.ingredientList.split(',').map(s => s.trim()).filter(Boolean),
        media: form.media.map(m => ({ uri: m.uri, type: m.type })),
        freshness: {
          expiryDate: form.freshnessExpiryDate || undefined,
          receiptDate: form.freshnessReceiptDate || undefined,
          attachments: form.freshnessMedia.map(m => ({ uri: m.uri, type: m.type, addedAt: new Date() })),
        },
      });
      Alert.alert('Saved', 'Meal published successfully');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [isValid, addMeal, user?.id, form, priceNumber]);

  const serviceDisclosure = 'HomeCookedPlate collects a 15% commission on each paid order.';

  // Show loading state
  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gradient.green} />
        </View>
      </View>
    );
  }

  // Show onboarding for non-sellers
  if (showOnboarding) {
    return (
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.orange}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerCard, { paddingTop: insets.top }]}
          >
            <View style={styles.headerInner}>
              <Text style={styles.title}>Become a PlateMaker</Text>
              <Text style={styles.subtitle}>Start selling your home-cooked meals</Text>
            </View>
          </LinearGradient>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.onboardingContent}>
          <View style={styles.onboardingSection}>
            <Text style={styles.onboardingTitle}>Why Become a PlateMaker?</Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons name="cash-outline" size={24} color={Colors.gradient.green} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>Earn Money</Text>
                  <Text style={styles.benefitDescription}>
                    Turn your cooking passion into income. Set your own prices and keep 85% of every sale.
                  </Text>
                </View>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="people-outline" size={24} color={Colors.gradient.green} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>Build Your Community</Text>
                  <Text style={styles.benefitDescription}>
                    Connect with food lovers in your area and build a loyal customer base.
                  </Text>
                </View>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="time-outline" size={24} color={Colors.gradient.green} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>Flexible Schedule</Text>
                  <Text style={styles.benefitDescription}>
                    Set your own availability windows and work on your own time.
                  </Text>
                </View>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="star-outline" size={24} color={Colors.gradient.green} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>Showcase Your Skills</Text>
                  <Text style={styles.benefitDescription}>
                    Share your unique recipes and cooking style with the community.
                  </Text>
                </View>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="shield-checkmark-outline" size={24} color={Colors.gradient.green} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>Secure Payments</Text>
                  <Text style={styles.benefitDescription}>
                    All transactions are processed securely through our platform.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.onboardingSection}>
            <Text style={styles.onboardingSubtitle}>Ready to Get Started?</Text>
            <Text style={styles.onboardingDescription}>
              Join our community of PlateMakers and start sharing your delicious home-cooked meals today!
            </Text>
          </View>

          <View style={styles.onboardingFooter}>
            <TouchableOpacity
              onPress={handleBecomeSeller}
              disabled={isUpgrading}
              style={styles.becomeSellerButton}
            >
              <LinearGradient
                colors={monoGradients.orange}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.becomeSellerGradient}
              >
                {isUpgrading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.becomeSellerText}>Become a Seller</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              Note: Account upgrades require admin approval for security. You'll be notified once your request is processed.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show the meal creation form for platemakers
  return (
    <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.red}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerCard, { paddingTop: insets.top }]}
          >
            <View style={styles.headerInner}>
              <Text style={styles.title}>Create New Meal</Text>
              <Text style={styles.subtitle}>Complete all required fields to publish</Text>
            </View>
          </LinearGradient>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <View style={styles.section}>
          <GradientButton
            title="Manage Promotions"
            onPress={() => router.push('/promotions')}
            baseColor="green"
            testID="manage-promotions"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Meal Name</Text>
          <TextInput
            value={form.name}
            onChangeText={t => onChange('name', t)}
            placeholder="e.g., Spicy Chicken Alfredo"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
            testID="meal-name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category / Cuisine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {cuisineTypes.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => onChange('category', c)}
                style={[styles.chip, form.category === c && styles.chipActive]}
                testID={`chip-${c}`}
              >
                <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            value={form.price}
            onChangeText={t => onChange('price', t.replace(/[^0-9.]/g, ''))}
            placeholder="e.g., 14.99"
            placeholderTextColor={Colors.gray[400]}
            keyboardType="decimal-pad"
            style={styles.input}
            testID="meal-price"
          />
          <Text style={styles.disclosureText} numberOfLines={2}>Fees Structure Disclosure: {serviceDisclosure}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Images / Videos</Text>
          <Text style={styles.helper}>Tap to select or drag-and-drop images or short videos (≤ 8s) here (web)</Text>
          <View style={styles.dropZone} testID="drop-zone">
            <View style={styles.dropZoneInner}>
              <TouchableOpacity onPress={pickMedia} style={styles.uploadAction} testID="pick-media">
                <Text style={styles.uploadActionText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={captureMedia} style={[styles.uploadAction, styles.uploadActionSecondary]} testID="capture-media" accessibilityLabel="Record video with camera">
                <Text style={[styles.uploadActionText, styles.uploadActionTextSecondary]}>Photo / Video</Text>
              </TouchableOpacity>
            </View>
          </View>

          {countdown > 0 && (
            <View style={styles.countdownOverlay} pointerEvents="none" testID="record-countdown">
              <View style={styles.countdownBox}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            </View>
          )}

          {form.media.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {form.media.map((item, idx) => (
                <View key={`${item.uri}-${idx}`} style={styles.previewItem}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: item.uri }} style={styles.previewImage} />
                  ) : (
                    Platform.OS === 'web' ? (
                      // @ts-ignore web-only built-in element
                      React.createElement('video', { style: styles.previewImage as any, controls: true, loop: true, src: item.uri, playsInline: true })
                    ) : (
                      <Video
                        testID={`preview-video-${idx}`}
                        source={{ uri: item.uri }}
                        style={styles.previewVideo}
                        useNativeControls
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={false}
                        onError={(e) => {
                          Alert.alert('Playback error', 'There was a problem playing this video.');
                        }}
                      />
                    )
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Availability Schedule</Text>
          <Text style={styles.helper}>Set when customers can pick up this meal</Text>
          {form.availabilityWindows.map((window, idx) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return (
              <View key={idx} style={styles.availabilityRow}>
                <View style={styles.dayPicker}>
                  <Text style={styles.smallLabel}>Day</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayChipsRow}>
                    {days.map((day, dayIdx) => (
                      <TouchableOpacity
                        key={dayIdx}
                        onPress={() => updateAvailabilityWindow(idx, 'dayOfWeek', dayIdx)}
                        style={[styles.dayChip, window.dayOfWeek === dayIdx && styles.dayChipActive]}
                        testID={`day-${idx}-${dayIdx}`}
                      >
                        <Text style={[styles.dayChipText, window.dayOfWeek === dayIdx && styles.dayChipTextActive]}>
                          {day.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={styles.smallLabel}>Start</Text>
                    <TextInput
                      value={window.startTime}
                      onChangeText={t => updateAvailabilityWindow(idx, 'startTime', t)}
                      placeholder="09:00"
                      placeholderTextColor={Colors.gray[400]}
                      style={styles.input}
                      testID={`start-time-${idx}`}
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={styles.smallLabel}>End</Text>
                    <TextInput
                      value={window.endTime}
                      onChangeText={t => updateAvailabilityWindow(idx, 'endTime', t)}
                      placeholder="17:00"
                      placeholderTextColor={Colors.gray[400]}
                      style={styles.input}
                      testID={`end-time-${idx}`}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => removeAvailabilityWindow(idx)}
                    style={styles.removeButton}
                    testID={`remove-window-${idx}`}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <GradientButton
            title="Add Time Window"
            onPress={addAvailabilityWindow}
            baseColor="purple"
            testID="add-availability"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ingredient Freshness Documentation</Text>
          <Text style={styles.helper}>Provide either Expiration Date of Ingredients or Date of Receipt</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.smallLabel}>Expiration Date (YYYY-MM-DD)</Text>
              <TextInput
                value={form.freshnessExpiryDate ?? ''}
                onChangeText={t => onChange('freshnessExpiryDate', t)}
                placeholder="2025-10-03"
                placeholderTextColor={Colors.gray[400]}
                style={styles.input}
                testID="expiry-date"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.smallLabel}>Receipt/Purchase Date (YYYY-MM-DD)</Text>
              <TextInput
                value={form.freshnessReceiptDate ?? ''}
                onChangeText={t => onChange('freshnessReceiptDate', t)}
                placeholder="2025-10-01"
                placeholderTextColor={Colors.gray[400]}
                style={styles.input}
                testID="receipt-date"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <GradientButton
            title="Add Ingredients Freshness"
            onPress={pickFreshnessMedia}
            baseColor="orange"
            testID="add-ingredients-freshness"
          />
          {form.freshnessMedia.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {form.freshnessMedia.map((item, idx) => (
                <View key={`${item.uri}-fresh-${idx}`} style={styles.previewItem}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: item.uri }} style={styles.previewImage} />
                  ) : (
                    Platform.OS === 'web' ? (
                      // @ts-ignore web-only built-in element
                      React.createElement('video', { style: styles.previewImage as any, controls: true, loop: true, src: item.uri, playsInline: true })
                    ) : (
                      <Video
                        testID={`preview-fresh-video-${idx}`}
                        source={{ uri: item.uri }}
                        style={styles.previewVideo}
                        useNativeControls
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={false}
                        onError={(e) => {
                          Alert.alert('Playback error', 'There was a problem playing this video.');
                        }}
                      />
                    )
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Full Ingredient List</Text>
          <TextInput
            value={form.ingredientList}
            onChangeText={t => onChange('ingredientList', t)}
            placeholder="List all ingredients. Example: Chicken, cream, garlic, parmesan, chili flakes..."
            placeholderTextColor={Colors.gray[400]}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={5}
            testID="ingredient-list"
          />
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.warningBox} testID="publish-warning">
          <ScrollView style={styles.warningScroll} showsVerticalScrollIndicator>
            <Text style={styles.warningText}>⚠️ You waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any items you publish as a PlateMaker and you affirm all local, county, state and federal food service laws are actively being adhered to by you, in every transaction via the HomeCookedPlate app.</Text>
          </ScrollView>
        </View>
        <View style={styles.foodSafetyAcknowledgmentBox}>
          <View style={styles.foodSafetyInfoRow}>
            <Ionicons name="information-circle" size={18} color={Colors.gradient.yellow} />
            <Text style={styles.foodSafetyInfoText}>
              We recommend reviewing{' '}
              <Text
                style={styles.foodSafetyLink}
                onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
              >
                cottagefoodlaws.com
              </Text>
              {' '}and doing your due diligence to meet all food safety requirements.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.acknowledgmentCheckboxRow}
            onPress={() => setFoodSafetyAcknowledged(!foodSafetyAcknowledged)}
            activeOpacity={0.7}
          >
            <View style={[styles.acknowledgmentCheckbox, foodSafetyAcknowledged && styles.acknowledgmentCheckboxActive]}>
              {foodSafetyAcknowledged && <Text style={styles.acknowledgmentCheckmark}>✓</Text>}
            </View>
            <Text style={styles.acknowledgmentText}>
              I acknowledge that I have reviewed cottagefoodlaws.com and understand that I must comply with all local, county, state and federal food laws. I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
            </Text>
          </TouchableOpacity>
        </View>
          <GradientButton
            title={saving ? 'Publishing…' : 'Save / Publish Meal'}
            onPress={saveMeal}
            disabled={!isValid || saving}
            loading={saving}
            baseColor="red"
            testID="publish-meal"
          />
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  staticHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerCard: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerInner: { paddingVertical: 16 },
  scrollContent: { paddingTop: 160 + 44, paddingBottom: 120 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.white },
  section: { paddingHorizontal: 24, marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: Colors.gray[900], marginBottom: 8 },
  smallLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[700], marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.gray[900],
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  chipsRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.gray[100],
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: { backgroundColor: monoGradients.red[0] },
  chipText: { color: Colors.gray[700], fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: Colors.white },
  helper: { color: Colors.gray[600], fontSize: 12, marginBottom: 8 },
  dropZone: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
  },
  dropZoneInner: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadAction: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadActionSecondary: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200] },
  uploadActionText: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  uploadActionTextSecondary: { color: Colors.gray[700] },
  previewRow: { gap: 12, paddingVertical: 8 },
  previewItem: { marginRight: 12 },
  previewImage: { width: 90, height: 90, borderRadius: 10 },
  previewVideo: { width: 90, height: 90, borderRadius: 10, backgroundColor: Colors.black },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[200] },
  videoBadge: { color: Colors.gray[900], fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  footerSpacer: { height: 24 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.gray[100], backgroundColor: Colors.white },
  disclosureText: { fontSize: 12, color: Colors.gray[600], marginTop: 8 },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: 9,
    borderRadius: 8,
    marginBottom: 9,
  },
  warningScroll: {
    height: 48,
  },
  warningText: { fontSize: 12, color: Colors.warning, lineHeight: 16 },
  foodSafetyAcknowledgmentBox: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  foodSafetyInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  foodSafetyInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray[700],
    lineHeight: 18,
  },
  foodSafetyLink: {
    color: Colors.gradient.green,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  acknowledgmentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  acknowledgmentCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.gray[300],
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  acknowledgmentCheckboxActive: {
    backgroundColor: Colors.gradient.green,
    borderColor: Colors.gradient.green,
  },
  acknowledgmentCheckmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  acknowledgmentText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray[700],
    lineHeight: 18,
  },
  countdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  countdownBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  countdownText: { color: Colors.white, fontSize: 48, fontWeight: '800' },
  availabilityRow: { marginBottom: 16, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.gray[200] },
  dayPicker: { marginBottom: 12 },
  dayChipsRow: { gap: 8, paddingVertical: 4 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.gray[100], borderRadius: 8 },
  dayChipActive: { backgroundColor: monoGradients.purple[0] },
  dayChipText: { color: Colors.gray[700], fontSize: 12, fontWeight: '600' },
  dayChipTextActive: { color: Colors.white },
  timeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  timeInput: { flex: 1 },
  removeButton: { width: 44, height: 44, backgroundColor: Colors.gray[100], borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { fontSize: 28, color: Colors.gray[600], fontWeight: '700' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  onboardingContent: {
    paddingTop: 200,
    paddingBottom: 40,
  },
  onboardingSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 24,
    textAlign: 'center',
  },
  onboardingSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  onboardingDescription: {
    fontSize: 16,
    color: Colors.gray[600],
    lineHeight: 24,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.gray[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  benefitText: {
    flex: 1,
    marginLeft: 16,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    lineHeight: 20,
  },
  onboardingFooter: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  becomeSellerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  becomeSellerGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeSellerText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 18,
  },
});