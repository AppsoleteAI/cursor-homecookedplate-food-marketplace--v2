import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Colors, monoGradients } from '@/constants/colors';
import { AuthColors, maroonButtonColors } from '@/constants/auth-palette';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { useAuth } from '@/hooks/auth-context';
import { FoodReviewPlayer } from '@/components/FoodReviewPlayer';
import {
  FOOD_INFLUENCER_MARK,
  FOOD_REVIEW_MAX_SECONDS,
  FOOD_REVIEW_REACTIONS,
  FOOD_REVIEW_REACTION_EMOJI_SIZE,
  exceedsFoodReviewClipLimit,
  foodReviewClipMeta,
  foodReviewDurationSeconds,
  foodReviewLinkClip,
  foodReviewReactionGap,
  foodReviewTimeline,
  foodReviewSurface,
  resolveFoodReviewTimelineLayout,
  seedFoodReviewClips,
  socialClipEmbed,
  socialClipSourceLabel,
  toggleFoodReviewReaction,
  type FoodReviewClip,
  type FoodReviewReaction,
} from '@/lib/food-review-clips';
import {
  readFoodReviewBookmarks,
  readFoodReviewClips,
  readFoodReviewReports,
  readHiddenFoodReviewClips,
  writeFoodReviewBookmarks,
  writeFoodReviewClips,
  writeFoodReviewReports,
  writeHiddenFoodReviewClips,
} from '@/lib/food-review-clip-store';
import { IdleChrome } from '@/components/IdleChrome';
import { CHROME_CHIP_SIZE, CHROME_ICON_SIZE } from '@/lib/chrome-activity';
import { readLocalMedia } from '@/lib/read-local-media';
import { trpc } from '@/lib/trpc';

const webHandle: ViewStyle | null = Platform.OS === 'web'
  ? ({ cursor: 'ns-resize', touchAction: 'none' } as unknown as ViewStyle)
  : null;

function ClipComposerSheet({
  children,
  width,
  keepFeed,
  releaseFeed,
}: {
  children: React.ReactNode;
  width: number;
  keepFeed: () => void;
  releaseFeed: () => void;
}) {
  const fullRef = useRef(0);
  const sheetRef = useRef<number | null>(null);
  const dragStart = useRef(0);
  const [fullHeight, setFullHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const [hot, setHot] = useState(false);
  const [dragging, setDragging] = useState(false);
  const webHover = Platform.OS === 'web'
    ? ({
        onMouseEnter: () => setHot(true),
        onMouseLeave: () => setHot(false),
      } as unknown as ViewProps)
    : null;
  const keepRef = useRef(keepFeed);
  const releaseRef = useRef(releaseFeed);
  keepRef.current = keepFeed;
  releaseRef.current = releaseFeed;

  useLayoutEffect(() => {
    if (sheetHeight === null) return;
    keepRef.current();
    const frame = requestAnimationFrame(() => keepRef.current());
    return () => cancelAnimationFrame(frame);
  }, [sheetHeight]);

  const remember = (next: number | null) => {
    sheetRef.current = next;
    setSheetHeight(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStart.current = sheetRef.current ?? fullRef.current;
        setDragging(true);
        keepRef.current();
      },
      onPanResponderMove: (_event, gesture) => {
        const next = dragStart.current + gesture.dy;
        remember(Math.min(fullRef.current, Math.max(0, next)));
        keepRef.current();
      },
      onPanResponderRelease: (_event, gesture) => {
        setDragging(false);
        setHot(false);
        if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.dx) < 8) {
          const current = sheetRef.current ?? fullRef.current;
          remember(current > fullRef.current / 2 ? 0 : fullRef.current);
        }
        releaseRef.current();
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        setHot(false);
        releaseRef.current();
      },
    }),
  ).current;

  const shown = sheetHeight === null ? (fullHeight > 0 ? fullHeight : undefined) : sheetHeight;

  return (
    <View style={[styles.sheet, { width }]}>
      <View style={[styles.sheetClip, shown === undefined ? null : { height: shown }]}>
        <View
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.height);
            const open = sheetRef.current === null || sheetRef.current >= fullRef.current - 1;
            if (!open || next <= 0 || next === fullRef.current) return;
            fullRef.current = next;
            setFullHeight(next);
          }}
        >
          {children}
        </View>
      </View>
      <View
        style={[styles.handleHit, webHandle]}
        testID="clip-sheet-handle"
        accessibilityRole="adjustable"
        accessibilityLabel="Drag the clip form"
        {...pan.panHandlers}
        {...webHover}
      >
        <View style={[styles.handleLine, (hot || dragging) && styles.handleLineHot]} />
      </View>
    </View>
  );
}

export default function FoodReviewClips() {
  const insets = useSafeAreaInsets();
  const isTab = useSegments()[0] === '(tabs)';
  const openedFrom = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = Array.isArray(openedFrom.returnTo) ? openedFrom.returnTo[0] : openedFrom.returnTo;
  const fromProfile = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//');
  const leave = useLeaveScreen('/(tabs)/profile', fromProfile || !isTab);
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const username = user?.username || 'Guest';
  const role: 'platemaker' | 'platetaker' = user?.role === 'platemaker' ? 'platemaker' : 'platetaker';
  const canPostClip = role === 'platemaker'
    ? user?.membershipTier === 'premium' || user?.membershipTier === 'lifetime' || Boolean(user?.stripeSubscriptionId)
    : user?.membershipTier === 'premium';
  const surface = foodReviewSurface(Platform.OS, width, height);
  const layout = resolveFoodReviewTimelineLayout(width, height, surface);

  const sharedClips = trpc.clips.list.useQuery(
    { metroArea: user?.metroArea || undefined },
    { retry: false, refetchOnWindowFocus: false },
  );
  const publishClip = trpc.clips.publish.useMutation();
  const publishClipLink = trpc.clips.publishLink.useMutation();
  const scrollRef = useRef<ScrollView>(null);
  const feedY = useRef(0);
  const lockedY = useRef<number | null>(null);
  const readFeed = useCallback(() => {
    const node = (scrollRef.current as { getScrollableNode?: () => { scrollTop?: number } } | null)?.getScrollableNode?.();
    return typeof node?.scrollTop === 'number' ? node.scrollTop : feedY.current;
  }, []);
  const keepFeed = useCallback(() => {
    if (lockedY.current == null) lockedY.current = readFeed();
    scrollRef.current?.scrollTo({ y: lockedY.current, animated: false });
  }, [readFeed]);
  const releaseFeed = useCallback(() => {
    const y = lockedY.current;
    if (y == null) return;
    scrollRef.current?.scrollTo({ y, animated: false });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      lockedY.current = null;
    });
  }, []);
  const [clips, setClips] = useState<FoodReviewClip[]>(seedFoodReviewClips);
  const [loaded, setLoaded] = useState(false);
  const [mealName, setMealName] = useState('');
  const [clipLink, setClipLink] = useState('');
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [query, setQuery] = useState('');
  const [menuClipId, setMenuClipId] = useState<string | null>(null);
  const [postNotice, setPostNotice] = useState('');
  const [reactionRowWidth, setReactionRowWidth] = useState(0);
  const [reactionChipWidth, setReactionChipWidth] = useState(0);
  const reactionGap = foodReviewReactionGap(reactionRowWidth, reactionChipWidth);
  const isPlatemaker = role === 'platemaker';
  const needle = query.trim().toLowerCase();
  const searchedClips = !isPlatemaker && needle
    ? clips.filter((clip) => (
      clip.mealName.toLowerCase().includes(needle) || clip.author.toLowerCase().includes(needle)
    ))
    : clips;
  const listedClips = (showBookmarks
    ? searchedClips.filter((clip) => bookmarkIds.includes(clip.id))
    : searchedClips
  ).filter((clip) => !hiddenIds.includes(clip.id));
  const visibleClips = foodReviewTimeline(listedClips);

  const loadClips = useCallback(() => {
    let active = true;
    readFoodReviewClips()
      .then((stored) => {
        if (active && stored) setClips(stored);
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

  useFocusEffect(useCallback(() => {
    const stop = loadClips();
    readFoodReviewBookmarks()
      .then(setBookmarkIds)
      .catch((error) => {
        console.error('[FoodReviewClips] Failed to load bookmarks', error);
      });
    readHiddenFoodReviewClips()
      .then(setHiddenIds)
      .catch((error) => {
        console.error('[FoodReviewClips] Failed to load hidden clips', error);
      });
    return stop;
  }, [loadClips]));

  useEffect(() => {
    if (!loaded) return;
    writeFoodReviewClips(clips).catch((error) => {
      console.error('[FoodReviewClips] Failed to save clips', error);
    });
  }, [clips, loaded]);

  useEffect(() => {
    if (!sharedClips.data?.length) return;
    setClips((prev) => {
      const ids = new Set(prev.map((clip) => clip.id));
      const incoming = sharedClips.data.filter((clip) => !ids.has(clip.id));
      return incoming.length > 0 ? [...incoming, ...prev] : prev;
    });
  }, [sharedClips.data]);

  const react = useCallback((clipId: string, kind: FoodReviewReaction) => {
    setClips((prev) => prev.map((item) => (
      item.id === clipId ? toggleFoodReviewReaction(item, username, kind) : item
    )));
  }, [username]);

  const addClip = useCallback(async (videoUri: string, duration: number | null | undefined) => {
    if (exceedsFoodReviewClipLimit(duration)) {
      Alert.alert('Clip too long', `FoodReviewClips are ${FOOD_REVIEW_MAX_SECONDS} seconds.`);
      return;
    }
    try {
      const file = await readLocalMedia(videoUri, 'video');
      const saved = await publishClip.mutateAsync({
        mealName: mealName.trim() || 'Food review',
        base64Data: file.base64,
        mimeType: file.mimeType,
        durationSeconds: foodReviewDurationSeconds(duration),
      });
      const clip: FoodReviewClip = {
        ...saved,
        role: saved.role === 'platetaker' ? 'platetaker' : 'platemaker',
      };
      setClips((prev) => [clip, ...prev.filter((item) => item.id !== clip.id)]);
      setMealName('');
    } catch (error) {
      Alert.alert('Clip', error instanceof Error ? error.message : 'The clip could not be posted.');
    }
  }, [mealName, publishClip]);

  const toggleBookmark = useCallback((clipId: string) => {
    setBookmarkIds((prev) => {
      const next = prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [clipId, ...prev];
      writeFoodReviewBookmarks(next).catch((error) => {
        console.error('[FoodReviewClips] Failed to save bookmarks', error);
      });
      return next;
    });
  }, []);

  const postLink = useCallback(async () => {
    if (!canPostClip) {
      setPostNotice('Posting is for premium members');
      return;
    }
    setPostNotice('');
    const link = foodReviewLinkClip(clipLink);
    if (!link) {
      Alert.alert('Clip link', 'Paste a YouTube, Facebook, TikTok, or Reddit link.');
      return;
    }
    const localClip: FoodReviewClip = {
      id: `clip-${Date.now()}`,
      mealName: mealName.trim() || 'Food review',
      author: username,
      role,
      videoUri: link.videoUri,
      posterUri: link.posterUri,
      durationSeconds: FOOD_REVIEW_MAX_SECONDS,
      durationMeasured: false,
      createdAt: new Date().toISOString(),
      counts: { smile: 0, heart: 0, star: 0 },
      reactionsByUser: {},
    };
    try {
      const saved = await publishClipLink.mutateAsync({
        mealName: localClip.mealName,
        videoUrl: link.videoUri,
      });
      const clip: FoodReviewClip = {
        ...saved,
        role: saved.role === 'platetaker' ? 'platetaker' : 'platemaker',
        durationMeasured: false,
      };
      setClips((prev) => [clip, ...prev.filter((item) => item.id !== clip.id && item.id !== localClip.id)]);
    } catch (error) {
      setClips((prev) => [localClip, ...prev.filter((item) => item.id !== localClip.id)]);
      console.error('[FoodReviewClips] Shared link post stayed on this device', error);
    }
    setMealName('');
    setClipLink('');
    setShowBookmarks(false);
  }, [canPostClip, clipLink, mealName, publishClipLink, role, username]);

  const hideClip = useCallback((clipId: string) => {
    setMenuClipId(null);
    setHiddenIds((prev) => {
      if (prev.includes(clipId)) return prev;
      const next = [clipId, ...prev];
      writeHiddenFoodReviewClips(next).catch((error) => {
        console.error('[FoodReviewClips] Failed to hide a clip', error);
      });
      return next;
    });
  }, []);

  const reportClip = useCallback((clipId: string) => {
    setMenuClipId(null);
    readFoodReviewReports()
      .then((current) => writeFoodReviewReports(current.includes(clipId) ? current : [clipId, ...current]))
      .catch((error) => {
        console.error('[FoodReviewClips] Failed to save a report', error);
      });
    Alert.alert('Clip reported', 'Thanks. This report stays on this device.');
  }, []);

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
    if (!canPostClip) {
      setPostNotice('Posting is for premium members');
      return;
    }
    setPostNotice('');
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
  }, [addClip, canPostClip, pickOnWeb]);

  const chooseClip = useCallback(async () => {
    if (!canPostClip) {
      setPostNotice('Posting is for premium members');
      return;
    }
    setPostNotice('');
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
  }, [addClip, canPostClip, pickOnWeb]);

  return (
    <View style={styles.container} testID="food-review-clips">
      <Stack.Screen options={{ headerShown: false, title: 'FoodReviewClips' }} />
      <LinearGradient
        colors={monoGradients.green}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        {isTab && !fromProfile ? null : <BackCircle tone="light" onPress={leave} testID="food-review-back" />}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>FoodReviewClips</Text>
          <Text style={styles.subtitle}>9:16 POV · {FOOD_REVIEW_MAX_SECONDS} second clips · premium</Text>
        </View>
      </LinearGradient>

      <View style={styles.pinned}>
        <ClipComposerSheet width={layout.columnWidth} keepFeed={keepFeed} releaseFeed={releaseFeed}>
        <View style={[styles.column, { width: layout.columnWidth }]}>
          {isPlatemaker ? null : (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search clips"
              placeholderTextColor={Colors.gray[400]}
              style={styles.search}
              testID="clip-search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <View style={styles.composer}>
            <TextInput
              value={mealName}
              onChangeText={setMealName}
              placeholder="Meal name"
              placeholderTextColor={Colors.gray[400]}
              style={styles.input}
              testID="clip-meal-name"
            />
            <TextInput
              value={clipLink}
              onChangeText={setClipLink}
              placeholder="YouTube, Facebook, TikTok, or Reddit link"
              placeholderTextColor={Colors.gray[400]}
              style={styles.input}
              testID="clip-link"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.composerActions}>
              <GlassPressable
                onPress={recordClip}
                testID="record-clip"
                style={styles.action}
              >
                <Text style={styles.actionText}>Record</Text>
              </GlassPressable>
              <GlassPressable
                onPress={chooseClip}
                testID="choose-clip"
                style={styles.actionSecondary}
              >
                <Text style={styles.actionSecondaryText}>Choose Clip</Text>
              </GlassPressable>
            </View>
            <GlassPressable
              onPress={postLink}
              testID="post-clip-link"
              style={[styles.action, styles.postLink]}
            >
              <Text style={styles.actionText}>Post Link</Text>
            </GlassPressable>
            {postNotice ? <Text style={styles.postNotice}>{postNotice}</Text> : null}
            <GlassPressable
              onPress={() => setShowBookmarks((current) => !current)}
              testID="clip-bookmarks"
              accessibilityRole="button"
              accessibilityState={{ selected: showBookmarks }}
              style={styles.bookmarks}
            >
              <Text style={styles.bookmarksText}>{showBookmarks ? 'All clips' : 'Bookmarks'}</Text>
            </GlassPressable>
          </View>
        </View>
        </ClipComposerSheet>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (lockedY.current != null) return;
          feedY.current = event.nativeEvent.contentOffset.y;
        }}
      >
        <View style={[styles.column, { width: layout.columnWidth }]}>
          {visibleClips.length === 0 ? (
            <Text style={styles.empty}>
              {showBookmarks ? 'No bookmarked clips yet.' : needle ? 'No clips match that search.' : 'No clips yet.'}
            </Text>
          ) : null}
          {visibleClips.map((clip) => {
            const mine = new Set(clip.reactionsByUser[username] ?? []);
            const saved = bookmarkIds.includes(clip.id);
            const source = socialClipEmbed(clip.videoUri).source;
            const openLabel = source === 'file' ? 'Open clip' : `Open on ${socialClipSourceLabel(source)}`;
            return (
              <View key={clip.id} style={styles.post} testID={`clip-${clip.id}`}>
                <View style={styles.authorRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{clip.author.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.authorCopy}>
                    <Text
                      style={styles.author}
                      numberOfLines={1}
                      accessibilityLabel={clip.verifiedInfluencer ? `@${clip.author}, verified food influencer` : `@${clip.author}`}
                    >
                      @{clip.author}{clip.verifiedInfluencer ? ` ${FOOD_INFLUENCER_MARK}` : ''}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>{foodReviewClipMeta(clip)}</Text>
                  </View>
                  <GlassPressable
                    onPress={() => toggleBookmark(clip.id)}
                    testID={`bookmark-${clip.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark clip'}
                    accessibilityState={{ selected: saved }}
                    style={styles.bookmarkClip}
                  >
                    <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={Colors.gray[900]} />
                  </GlassPressable>
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
                    <IdleChrome overlay>
                      <GlassPressable
                        style={styles.moreButton}
                        testID="clip-more"
                        accessibilityRole="button"
                        accessibilityLabel="Clip menu"
                        onPress={() => setMenuClipId((current) => (current === clip.id ? null : clip.id))}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={Colors.white} />
                      </GlassPressable>
                    </IdleChrome>
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
                          <Text style={styles.moreItemText}>{openLabel}</Text>
                        </GlassPressable>
                        <GlassPressable
                          style={styles.moreItem}
                          testID={`report-${clip.id}`}
                          onPress={() => reportClip(clip.id)}
                        >
                          <Text style={styles.moreItemText}>Report this clip</Text>
                        </GlassPressable>
                        <GlassPressable
                          style={styles.moreItem}
                          testID={`hide-${clip.id}`}
                          onPress={() => hideClip(clip.id)}
                        >
                          <Text style={styles.moreItemText}>Hide this clip</Text>
                        </GlassPressable>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View
                  style={[styles.actions, { gap: reactionGap }]}
                  testID="food-review-reactions"
                  onLayout={(event) => setReactionRowWidth(event.nativeEvent.layout.width)}
                >
                  {FOOD_REVIEW_REACTIONS.map((reaction, index) => {
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
                        onLayout={index === 0 ? (event) => setReactionChipWidth(event.nativeEvent.layout.width) : undefined}
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
        </View>
      </ScrollView>
      <IdleChrome overlay>
        <View style={[styles.scrollJumps, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <GlassPressable
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            testID="clips-scroll-up"
            accessibilityRole="button"
            accessibilityLabel="Scroll to top"
            style={styles.jump}
          >
            <LinearGradient colors={[...maroonButtonColors]} locations={[0, 0.42, 1]} style={styles.jumpFill}>
              <Ionicons name="chevron-up" size={CHROME_ICON_SIZE} color={AuthColors.gold} />
            </LinearGradient>
          </GlassPressable>
          <GlassPressable
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            testID="clips-scroll-down"
            accessibilityRole="button"
            accessibilityLabel="Scroll to bottom"
            style={styles.jump}
          >
            <LinearGradient colors={[...maroonButtonColors]} locations={[0, 0.42, 1]} style={styles.jumpFill}>
              <Ionicons name="chevron-down" size={CHROME_ICON_SIZE} color={AuthColors.gold} />
            </LinearGradient>
          </GlassPressable>
        </View>
      </IdleChrome>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    alignItems: 'flex-start',
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
    paddingBottom: 96,
  },
  pinned: {
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  feed: {
    flex: 1,
    ...(Platform.OS === 'web' ? { overflowAnchor: 'none' as const } : null),
  },
  sheet: {
    width: '100%',
    alignItems: 'center',
  },
  sheetClip: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  handleHit: {
    width: '100%',
    height: 18,
    justifyContent: 'flex-end',
  },
  handleLine: {
    width: '100%',
    height: 0,
    backgroundColor: Colors.gray[400],
  },
  handleLineHot: {
    height: 4,
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
  bookmarkClip: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  search: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.gray[900],
    marginTop: 12,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
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
    fontSize: FOOD_REVIEW_REACTION_EMOJI_SIZE,
    lineHeight: FOOD_REVIEW_REACTION_EMOJI_SIZE + 6,
  },
  reactionCount: {
    fontSize: 16,
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
    paddingTop: 8,
  },
  postLink: {
    marginTop: 8,
  },
  bookmarks: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  bookmarksText: {
    color: Colors.gray[800],
    fontWeight: '700',
  },
  scrollJumps: {
    position: 'absolute',
    right: 16,
    gap: 8,
  },
  jump: {
    width: CHROME_CHIP_SIZE,
    height: CHROME_CHIP_SIZE,
    borderRadius: CHROME_CHIP_SIZE / 2,
    overflow: 'hidden',
  },
  jumpFill: {
    width: CHROME_CHIP_SIZE,
    height: CHROME_CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postNotice: {
    marginTop: 12,
    color: Colors.gray[600],
    fontSize: 14,
    lineHeight: 20,
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
});
