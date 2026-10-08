import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, monoGradients } from '@/constants/colors';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { useAuth } from '@/hooks/auth-context';
import { FoodReviewPlayer } from '@/components/FoodReviewPlayer';
import {
  FOOD_REVIEW_CLIPS_KEY,
  FOOD_REVIEW_MAX_SECONDS,
  FOOD_REVIEW_REACTIONS,
  exceedsFoodReviewClipLimit,
  foodReviewDurationSeconds,
  foodReviewSurface,
  resolveFoodReviewTimelineLayout,
  seedFoodReviewClips,
  toggleFoodReviewReaction,
  type FoodReviewClip,
  type FoodReviewReaction,
} from '@/lib/food-review-clips';

function isStoredClip(value: unknown): value is FoodReviewClip {
  if (!value || typeof value !== 'object') return false;
  const clip = value as FoodReviewClip;
  return typeof clip.id === 'string' && typeof clip.videoUri === 'string' && typeof clip.mealName === 'string';
}

export default function FoodReviewClips() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const isPremium = user?.membershipTier === 'premium';
  const username = user?.username || 'Guest';
  const role: 'platemaker' | 'platetaker' = user?.role === 'platemaker' ? 'platemaker' : 'platetaker';
  const surface = foodReviewSurface(Platform.OS, width, height);
  const layout = resolveFoodReviewTimelineLayout(width, height, surface);

  const [clips, setClips] = useState<FoodReviewClip[]>(seedFoodReviewClips);
  const [loaded, setLoaded] = useState(false);
  const [mealName, setMealName] = useState('');
  const [menuClipId, setMenuClipId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(FOOD_REVIEW_CLIPS_KEY)
      .then((raw) => {
        if (!active) return;
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(isStoredClip) && parsed.length > 0) {
          setClips(parsed);
        }
      })
      .catch((error) => {
        console.error('[FoodReviewClips] Failed to load clips', error);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(FOOD_REVIEW_CLIPS_KEY, JSON.stringify(clips)).catch((error) => {
      console.error('[FoodReviewClips] Failed to save clips', error);
    });
  }, [clips, loaded]);

  const react = useCallback((clipId: string, kind: FoodReviewReaction) => {
    setClips((prev) => prev.map((item) => (
      item.id === clipId ? toggleFoodReviewReaction(item, username, kind) : item
    )));
  }, [username]);

  const addClip = useCallback((videoUri: string, duration: number | null | undefined, posterUri?: string) => {
    if (exceedsFoodReviewClipLimit(duration)) {
      Alert.alert('Clip too long', `FoodReviewClips are ${FOOD_REVIEW_MAX_SECONDS} seconds.`);
      return;
    }
    const next: FoodReviewClip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mealName: mealName.trim() || 'Food review',
      author: username,
      role,
      videoUri,
      posterUri: posterUri || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
      durationSeconds: foodReviewDurationSeconds(duration),
      createdAt: new Date().toISOString(),
      counts: { smile: 0, heart: 0, star: 0 },
      reactionsByUser: {},
    };
    setClips((prev) => [next, ...prev]);
    setMealName('');
  }, [mealName, role, username]);

  const pickOnWeb = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        if (exceedsFoodReviewClipLimit(video.duration)) {
          URL.revokeObjectURL(objectUrl);
          Alert.alert('Clip too long', `FoodReviewClips are ${FOOD_REVIEW_MAX_SECONDS} seconds.`);
          return;
        }
        addClip(objectUrl, video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        Alert.alert('Could not read that video', 'Choose a clip up to 20 seconds.');
      };
      video.src = objectUrl;
    };
    input.click();
  }, [addClip]);

  const recordClip = useCallback(async () => {
    if (!isPremium) {
      router.push('/membership' as Href);
      return;
    }
    if (Platform.OS === 'web') {
      pickOnWeb();
      return;
    }
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const microphone = await requestRecordingPermissionsAsync();
    if (!camera.granted || !microphone.granted) {
      Alert.alert('Permission required', 'Camera and microphone access are required to record a 20 second clip.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: FOOD_REVIEW_MAX_SECONDS,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    addClip(asset.uri, asset.duration);
  }, [addClip, isPremium, pickOnWeb]);

  const chooseClip = useCallback(async () => {
    if (!isPremium) {
      router.push('/membership' as Href);
      return;
    }
    if (Platform.OS === 'web') {
      pickOnWeb();
      return;
    }
    const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!library.granted) {
      Alert.alert('Permission required', 'Photo library access is required to choose a clip.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: FOOD_REVIEW_MAX_SECONDS,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    addClip(asset.uri, asset.duration);
  }, [addClip, isPremium, pickOnWeb]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile' as Href);
  };

  return (
    <View style={styles.container} testID="food-review-clips">
      <Stack.Screen options={{ headerShown: false, title: 'FoodReviewClips' }} />
      <LinearGradient
        colors={monoGradients.green}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <GlassPressable onPress={goBack} testID="food-review-back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.white} />
        </GlassPressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>FoodReviewClips</Text>
          <Text style={styles.subtitle}>9:16 POV · {FOOD_REVIEW_MAX_SECONDS} second clips · premium</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { width: layout.columnWidth }]}>
          {clips.length === 0 ? <Text style={styles.empty}>No clips yet.</Text> : null}
          {clips.map((clip) => {
            const mine = new Set(clip.reactionsByUser[username] ?? []);
            return (
              <View key={clip.id} style={styles.post} testID={`clip-${clip.id}`}>
                <View style={styles.authorRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{clip.author.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.authorCopy}>
                    <Text style={styles.author} numberOfLines={1}>@{clip.author}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{clip.role} · {clip.durationSeconds}s</Text>
                  </View>
                </View>
                <Text style={styles.mealName}>{clip.mealName}</Text>
                <View style={styles.playerWrap}>
                  <View style={[styles.playerSlot, { width: layout.width, height: layout.height }]}>
                    <FoodReviewPlayer
                      uri={clip.videoUri}
                      posterUri={clip.posterUri}
                      width={layout.width}
                      height={layout.height}
                    />
                    <GlassPressable
                      style={styles.moreButton}
                      testID="clip-more"
                      accessibilityRole="button"
                      accessibilityLabel="Clip menu"
                      onPress={() => setMenuClipId((current) => (current === clip.id ? null : clip.id))}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={Colors.white} />
                    </GlassPressable>
                    {menuClipId === clip.id ? (
                      <View style={styles.moreMenu}>
                        <GlassPressable
                          style={styles.moreItem}
                          onPress={() => {
                            setMenuClipId(null);
                            Linking.openURL(clip.videoUri).catch(() => {
                              Alert.alert('Could not open that clip');
                            });
                          }}
                        >
                          <Text style={styles.moreItemText}>Watch on YouTube</Text>
                        </GlassPressable>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.actions} testID="food-review-reactions">
                  {FOOD_REVIEW_REACTIONS.map((reaction) => {
                    const selected = mine.has(reaction.kind);
                    return (
                      <GlassPressable
                        key={reaction.kind}
                        testID={`reaction-${reaction.kind}`}
                        accessibilityRole="button"
                        accessibilityLabel={reaction.label}
                        accessibilityState={{ selected }}
                        onPress={() => react(clip.id, reaction.kind)}
                        style={[styles.actionChip, selected && styles.actionChipSelected]}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        <Text
                          testID={`reaction-${reaction.kind}-count`}
                          style={[styles.reactionCount, selected && styles.reactionCountSelected]}
                        >
                          {clip.counts[reaction.kind]}
                        </Text>
                      </GlassPressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

        <View style={styles.composer}>
          <Text style={styles.composerTitle}>
            {isPremium ? 'Post a 20 second clip' : 'Posting is for premium members'}
          </Text>
          <TextInput
            value={mealName}
            onChangeText={setMealName}
            placeholder="Meal name"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
            testID="clip-meal-name"
            editable={isPremium}
          />
          <View style={styles.composerActions}>
            <GlassPressable
              onPress={recordClip}
              testID="record-clip"
              style={[styles.action, !isPremium && styles.actionLocked]}
            >
              <Text style={styles.actionText}>{isPremium ? 'Record' : 'See Membership'}</Text>
            </GlassPressable>
            <GlassPressable
              onPress={chooseClip}
              testID="choose-clip"
              style={[styles.actionSecondary, !isPremium && styles.actionLocked]}
            >
              <Text style={styles.actionSecondaryText}>{isPremium ? 'Choose Clip' : 'Premium'}</Text>
            </GlassPressable>
          </View>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    ...glassSurface,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.white,
    opacity: 0.9,
    marginTop: 2,
  },
  content: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 48,
  },
  column: {
    alignSelf: 'center',
  },
  post: {
    paddingTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray[200],
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  authorCopy: {
    flex: 1,
  },
  author: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  meta: {
    color: Colors.gray[500],
    fontSize: 13,
    marginTop: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginTop: 8,
    marginBottom: 10,
  },
  playerWrap: {
    alignItems: 'stretch',
  },
  playerSlot: {
    position: 'relative',
  },
  moreButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20,16,12,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...glassSurface,
  },
  moreMenu: {
    position: 'absolute',
    top: 44,
    right: 8,
    minWidth: 168,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 4,
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  moreItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  moreItemText: {
    color: Colors.gray[900],
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actionChipSelected: {
    backgroundColor: Colors.gray[100],
  },
  reactionEmoji: {
    fontSize: 13.5,
  },
  reactionCount: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  reactionCountSelected: {
    color: Colors.gray[900],
  },
  empty: {
    color: Colors.gray[500],
    padding: 24,
  },
  composer: {
    marginTop: 20,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.gray[900],
    marginBottom: 10,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    backgroundColor: Colors.gradient.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: Colors.white,
    fontWeight: '700',
  },
  actionSecondary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  actionSecondaryText: {
    color: Colors.gray[800],
    fontWeight: '700',
  },
  actionLocked: {
    opacity: 0.85,
  },
});
