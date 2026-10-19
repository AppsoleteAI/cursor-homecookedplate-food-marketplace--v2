import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, inAppHeaderBand, monoGradients, pagePastel } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { router , type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { calculateOrderBreakdown, calculateOrderSplit } from '@/lib/fees';
import { onPlatePublished, writePlateDraft } from '@/lib/plate-draft';

// Import expo-video with platform-specific shim for web compatibility
// Metro will automatically resolve to lib/expo-video.web.ts on web platform
import { useVideoPlayer, VideoView } from '@/lib/expo-video';

type MediaType = 'image' | 'video';
interface MediaItem {
  uri: string;
  type: MediaType;
  duration?: number;
}

// Video preview component using expo-video (native only)
function VideoPreview({ uri, testID }: { uri: string; testID?: string }) {
  // Call hook unconditionally (hooks must be called at top level)
  // Use a dummy URI on web to satisfy hook rules
  const player = useVideoPlayer(Platform.OS === 'web' ? '' : uri, (player: any) => {
    if (player && Platform.OS !== 'web') {
      player.loop = true;
      player.muted = true; // Muted for preview
    }
  });

  // Only render on native platforms - web uses native <video> element
  if (Platform.OS === 'web') {
    return null;
  }

  // Safety check for native platforms
  if (!VideoView) {
    console.warn('[VideoPreview] expo-video not available on this platform');
    return null;
  }

  return (
    <VideoView
      testID={testID}
      player={player}
      style={styles.previewVideo}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      contentFit="cover"
      nativeControls={true}
    />
  );
}

interface FormState {
  name: string;
  price: string;
  media: MediaItem[];
  postVideoToTimeline: boolean;
  availabilityWindows: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

export default function CreateMealScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: '',
    price: '',
    media: [],
    postVideoToTimeline: false,
    availabilityWindows: [],
  });
  const [countdown, setCountdown] = useState<number>(0);

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

  const pickVideo = useCallback(async () => {
    const hasPerm = await ensureLibraryPermission();
    if (!hasPerm) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const duration = typeof asset.duration === 'number' ? asset.duration : undefined;
    const seconds = typeof duration === 'number' ? (duration >= 1000 ? duration / 1000 : duration) : 0;
    if (seconds > 8) {
      Alert.alert('Video too long', 'Please upload a video up to 8 seconds.');
      return;
    }
    setForm(prev => ({ ...prev, media: [...prev.media, { uri: asset.uri, type: 'video', duration }] }));
  }, [ensureLibraryPermission]);

  const pickMedia = useCallback(async () => {
    const hasPerm = await ensureLibraryPermission();
    if (!hasPerm) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  // Calculate fee breakdown for real-time transparency
  const feeBreakdown = useMemo(() => {
    if (priceNumber <= 0 || !Number.isFinite(priceNumber)) {
      return null;
    }
    try {
      const buyerBreakdown = calculateOrderBreakdown(priceNumber, 1);
      const sellerSplit = calculateOrderSplit(priceNumber);
      return {
        listedPrice: priceNumber,
        customerPays: buyerBreakdown.total,
        chefReceives: sellerSplit.sellerPayout,
        platformFee: buyerBreakdown.platformFee,
        platformRevenue: sellerSplit.appRevenue,
      };
    } catch (error) {
      console.error('[CreateMeal] Fee calculation error:', error);
      return null;
    }
  }, [priceNumber]);

  useEffect(() => onPlatePublished(() => {
    setForm({
      name: '',
      price: '',
      media: [],
      postVideoToTimeline: false,
      availabilityWindows: [],
    });
  }), []);

  const openPublish = useCallback(() => {
    writePlateDraft({
      name: form.name,
      price: form.price,
      media: form.media,
      postVideoToTimeline: form.postVideoToTimeline && form.media.some((item) => item.type === 'video'),
    });
    router.push('/publish-plate' as Href);
  }, [form.name, form.price, form.media, form.postVideoToTimeline]);

  const serviceDisclosure = 'Fee Structure: Customer pays listed price + 10% (buyer fee). You receive listed price - 10% (seller fee). Platform total: 20%. If you set a delivery fee, the customer pays that amount plus 5%, and you receive the amount you set.';

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
        <View style={[styles.staticHeader, { top: insets.top }]}>
          <LinearGradient
            colors={monoGradients.orange}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.height ?? 0;
              if (next !== headerHeight) setHeaderHeight(next);
            }}
          >
            <View style={styles.headerInner}>
              <Text style={styles.title}>Become a PlateMaker</Text>
              <Text style={styles.subtitle}>Start selling your home-cooked meals</Text>
            </View>
          </LinearGradient>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.onboardingContent, { paddingTop: insets.top + headerHeight + 12 }]}>
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
            <GlassPressable
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
            </GlassPressable>
            <Text style={styles.disclaimerText}>
              Note: Account upgrades require admin approval for security. You&apos;ll be notified once your request is processed.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show the meal creation form for platemakers
  return (
    <View style={styles.container}>
        <View style={[styles.staticHeader, { top: insets.top }]}>
          <LinearGradient
            colors={monoGradients.red}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.height ?? 0;
              if (next !== headerHeight) setHeaderHeight(next);
            }}
          >
            <View style={styles.headerInner}>
              <Text style={styles.title}>Create New Meal</Text>
              <Text style={styles.subtitle}>Name, price, and one photo</Text>
            </View>
          </LinearGradient>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + headerHeight + 12 }]}>

          <View style={styles.section}>
          <GradientButton
            title="Manage Promotions"
            onPress={() => router.push('/promotions')}
            baseColor="red"
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
          <Text style={styles.disclosureText}>Fees Structure Disclosure: {serviceDisclosure}</Text>
          
          {feeBreakdown && (
            <View style={styles.feeBreakdownContainer} testID="fee-breakdown">
              <View style={styles.feeBreakdownHeader}>
                <Ionicons name="information-circle" size={18} color={Colors.gradient.green} />
                <Text style={styles.feeBreakdownTitle}>Fee Transparency</Text>
              </View>
              <View style={styles.feeBreakdownRow}>
                <Text style={styles.feeBreakdownLabel}>Listed Price:</Text>
                <Text style={styles.feeBreakdownValue}>${feeBreakdown.listedPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.feeBreakdownRow}>
                <Text style={styles.feeBreakdownLabel}>Customer Pays:</Text>
                <Text style={[styles.feeBreakdownValue, styles.feeBreakdownValueBold]}>
                  ${feeBreakdown.customerPays.toFixed(2)}
                </Text>
              </View>
              <View style={styles.feeBreakdownRow}>
                <Text style={styles.feeBreakdownLabel}>You Receive:</Text>
                <Text style={[styles.feeBreakdownValue, styles.feeBreakdownValueGreen]}>
                  ${feeBreakdown.chefReceives.toFixed(2)}
                </Text>
              </View>
              <View style={styles.feeBreakdownRow}>
                <Text style={styles.feeBreakdownLabel}>Platform Fee (20%):</Text>
                <Text style={styles.feeBreakdownValue}>${feeBreakdown.platformRevenue.toFixed(2)}</Text>
              </View>
              <Text style={styles.feeBreakdownNote}>
                Includes 10% buyer fee + 10% seller fee. A delivery fee adds 5% for the customer. You receive the delivery amount you set.
              </Text>
            </View>
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
                      <GlassPressable
                        key={dayIdx}
                        onPress={() => updateAvailabilityWindow(idx, 'dayOfWeek', dayIdx)}
                        style={[styles.dayChip, window.dayOfWeek === dayIdx && styles.dayChipActive]}
                        testID={`day-${idx}-${dayIdx}`}
                      >
                        <Text style={[styles.dayChipText, window.dayOfWeek === dayIdx && styles.dayChipTextActive]}>
                          {day.slice(0, 3)}
                        </Text>
                      </GlassPressable>
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
                  <GlassPressable
                    onPress={() => removeAvailabilityWindow(idx)}
                    style={styles.removeButton}
                    testID={`remove-window-${idx}`}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </GlassPressable>
                </View>
              </View>
            );
          })}
          <GradientButton
            title="Add Time Window"
            onPress={addAvailabilityWindow}
            baseColor="red"
            testID="add-availability"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Photo</Text>
          <Text style={styles.helper}>One photo publishes the plate. A short video is optional.</Text>
          <View style={styles.dropZone} testID="drop-zone">
            <View style={styles.dropZoneInner}>
              <GlassPressable onPress={pickMedia} style={styles.uploadAction} testID="pick-media">
                <Text style={styles.uploadActionText}>Choose a photo</Text>
              </GlassPressable>
              <GlassPressable onPress={pickVideo} style={[styles.uploadAction, styles.uploadActionSecondary]} testID="pick-video" accessibilityLabel="Upload a video">
                <Text style={[styles.uploadActionText, styles.uploadActionTextSecondary]}>Upload a video</Text>
              </GlassPressable>
              <GlassPressable onPress={captureMedia} style={[styles.uploadAction, styles.uploadActionSecondary]} testID="capture-media" accessibilityLabel="Record video with camera">
                <Text style={[styles.uploadActionText, styles.uploadActionTextSecondary]}>Photo / Video</Text>
              </GlassPressable>
            </View>
          </View>

          {countdown > 0 && (
            <View style={styles.countdownOverlay} pointerEvents="none" testID="record-countdown">
              <View style={styles.countdownBox}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            </View>
          )}

          {form.media.some((item) => item.type === 'video') ? (
            <GlassPressable
              onPress={() => onChange('postVideoToTimeline', !form.postVideoToTimeline)}
              style={styles.clipOption}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.postVideoToTimeline }}
              accessibilityLabel="Also post this video on FoodReviewClips"
              testID="post-video-to-clips"
            >
              <Ionicons
                name={form.postVideoToTimeline ? 'checkbox' : 'square-outline'}
                size={22}
                color={Colors.gradient.green}
              />
              <View style={styles.clipOptionCopy}>
                <Text style={styles.clipOptionTitle}>Also post this video on FoodReviewClips</Text>
                <Text style={styles.clipOptionBody}>The video stays on this plate and is added to the clip timeline.</Text>
              </View>
            </GlassPressable>
          ) : null}

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
                      <VideoPreview
                        uri={item.uri}
                        testID={`preview-video-${idx}`}
                      />
                    )
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <GradientButton
            title="Review and publish"
            onPress={openPublish}
            baseColor="red"
            testID="open-publish-plate"
          />
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: pagePastel.red },
  staticHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerCard: {
    paddingHorizontal: inAppHeaderBand.paddingHorizontal,
    paddingTop: inAppHeaderBand.paddingTop,
    paddingBottom: inAppHeaderBand.paddingBottom,
    minHeight: inAppHeaderBand.minHeight,
    justifyContent: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  headerInner: { paddingVertical: 0 },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: inAppHeaderBand.titleSize, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: inAppHeaderBand.subtitleSize, color: Colors.white },
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
    ...glassSurface,
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
    flexWrap: 'wrap',
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
  clipOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingVertical: 4,
  },
  clipOptionCopy: {
    flex: 1,
  },
  clipOptionTitle: {
    color: Colors.gray[900],
    fontWeight: '700',
    fontSize: 15,
  },
  clipOptionBody: {
    color: Colors.gray[600],
    fontSize: 13,
    marginTop: 2,
  },
  previewRow: { gap: 12, paddingVertical: 8 },
  previewItem: { marginRight: 12 },
  previewImage: { width: 90, height: 90, borderRadius: 10 },
  previewVideo: { width: 90, height: 90, borderRadius: 10, backgroundColor: Colors.black },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[200] },
  videoBadge: { color: Colors.gray[900], fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  footerSpacer: { height: 24 },
  disclosureText: { fontSize: 12, color: Colors.gray[600], marginTop: 8 },
  feeBreakdownContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gradient.green,
  },
  feeBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  feeBreakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gradient.green,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeBreakdownLabel: {
    fontSize: 14,
    color: Colors.gray[700],
    flex: 1,
  },
  feeBreakdownValue: {
    fontSize: 14,
    color: Colors.gray[900],
    fontWeight: '500',
  },
  feeBreakdownValueBold: {
    fontWeight: '700',
    color: Colors.gradient.green,
  },
  feeBreakdownValueGreen: {
    fontWeight: '700',
    color: Colors.gradient.green,
  },
  feeBreakdownNote: {
    fontSize: 11,
    color: Colors.gray[500],
    fontStyle: 'italic',
    marginTop: 8,
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
    backgroundColor: pagePastel.red,
  },
  onboardingContent: {
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