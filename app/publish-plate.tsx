import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SellerOnly } from '@/components/RoleGuard';
import { BackCircle } from '@/components/BackCircle';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { GradientButton } from '@/components/GradientButton';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { useAuth } from '@/hooks/auth-context';
import { useMeals } from '@/hooks/meals-context';
import { trpc } from '@/lib/trpc';
import { readLocalMedia } from '@/lib/read-local-media';
import { canPublishMeal } from '@/lib/meal-publish';
import { markPlatePublished, readPlateDraft, type PlateDraft } from '@/lib/plate-draft';
import { appendFoodReviewClip } from '@/lib/food-review-clip-store';
import { foodReviewDurationSeconds } from '@/lib/food-review-clips';
import { Colors, pagePastel } from '@/constants/colors';

const EMPTY: PlateDraft = { name: '', price: '', media: [], postVideoToTimeline: false };

export default function PublishPlateScreen() {
  const leave = useLeaveScreen('/(tabs)/create-meal');
  const { user } = useAuth();
  const { addMeal } = useMeals();
  const createMeal = trpc.meals.create.useMutation();
  const uploadMedia = trpc.media.upload.useMutation();
  const [draft, setDraft] = useState<PlateDraft>(EMPTY);
  const [foodSafetyAcknowledged, setFoodSafetyAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    setDraft(readPlateDraft());
  }, []));

  useEffect(() => {
    if (user?.foodSafetyAcknowledged) setFoodSafetyAcknowledged(true);
  }, [user?.foodSafetyAcknowledged]);

  const priceNumber = useMemo(() => {
    const value = Number(draft.price);
    return Number.isFinite(value) ? value : 0;
  }, [draft.price]);

  const photoCount = useMemo(
    () => draft.media.filter((item) => item.type === 'image').length,
    [draft.media],
  );

  const isValid = useMemo(
    () => canPublishMeal({
      name: draft.name,
      price: priceNumber,
      photoCount,
      foodSafetyAcknowledged,
    }),
    [draft.name, priceNumber, photoCount, foodSafetyAcknowledged],
  );

  const missing = useMemo(() => {
    const items: string[] = [];
    if (draft.name.trim().length === 0) items.push('Meal name, on Create Meal');
    if (!(priceNumber > 0)) items.push('A price above zero, on Create Meal');
    if (photoCount < 1) items.push('One photo, on Create Meal');
    if (!foodSafetyAcknowledged) items.push('The food-safety acknowledgment on this page');
    return items;
  }, [draft.name, priceNumber, photoCount, foodSafetyAcknowledged]);

  const saveMeal = useCallback(async () => {
    if (!isValid || saving) return;
    try {
      setSaving(true);
      const created = await createMeal.mutateAsync({
        name: draft.name.trim(),
        description: draft.name.trim(),
        price: Number(priceNumber),
        images: [],
        ingredients: [],
        cuisine: '',
        category: 'dinner',
        preparationTime: 30,
      });
      const media: { uri: string; type: 'image' | 'video' }[] = [];
      for (const item of draft.media) {
        const file = await readLocalMedia(item.uri, item.type);
        const uploaded = await uploadMedia.mutateAsync({
          mealId: created.id,
          base64Data: file.base64,
          mimeType: file.mimeType,
          type: item.type,
        });
        media.push({ uri: uploaded.uri, type: uploaded.type === 'video' ? 'video' : 'image' });
      }
      await addMeal({
        id: created.id,
        ownerId: user?.id ?? 'unknown',
        name: draft.name.trim(),
        category: '',
        price: Number(priceNumber),
        ingredients: [],
        media,
        freshness: { attachments: [] },
      });
      const timelineVideo = draft.postVideoToTimeline
        ? media.find((item) => item.type === 'video')
        : undefined;
      if (timelineVideo) {
        const source = draft.media.find((item) => item.type === 'video');
        const poster = media.find((item) => item.type === 'image')?.uri
          || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800';
        await appendFoodReviewClip({
          id: `meal-${created.id}`,
          mealName: draft.name.trim() || 'Food review',
          author: user?.username || 'platemaker',
          role: 'platemaker',
          videoUri: timelineVideo.uri,
          posterUri: poster,
          durationSeconds: foodReviewDurationSeconds(source?.duration),
          createdAt: new Date().toISOString(),
          counts: { smile: 0, heart: 0, star: 0 },
          reactionsByUser: {},
        });
      }
      markPlatePublished();
      router.replace({ pathname: '/meal-details', params: { id: created.id } } as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save meal. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, createMeal, draft, priceNumber, uploadMedia, addMeal, user?.id, user?.username]);

  return (
    <SellerOnly>
      <SafeAreaView style={styles.screen} testID="publish-plate">
        <Stack.Screen options={{ headerShown: false, title: 'Publish this plate' }} />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BackCircle tone="honey" onPress={leave} testID="publish-plate-back" />
          <Text style={styles.title}>Publish this plate</Text>
          <Text style={styles.subtitle}>
            {draft.name.trim() || 'This plate has no name yet.'}
            {priceNumber > 0 ? ` · $${priceNumber.toFixed(2)}` : ''}
            {photoCount > 0 ? ` · ${photoCount} photo` : ''}
          </Text>

          <View style={styles.warningBox} testID="publish-warning">
            <Text style={styles.warningText}>⚠️ You waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any items you publish as a PlateMaker and you affirm all local, county, state and federal food service laws are actively being adhered to by you, in every transaction via the HomeCookedPlate app.</Text>
          </View>

          <View style={styles.foodSafetyAcknowledgmentBox}>
            <View style={styles.foodSafetyInfoRow}>
              <Ionicons name="information-circle" size={18} color={Colors.gradient.yellow} />
              <View style={{ flex: 1 }}>
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
                <Text style={[styles.foodSafetyInfoText, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
                  HomeCookedPlate is not affiliated or in partnership with cottagefoodlaws.com.
                </Text>
                <Text style={[styles.foodSafetyInfoText, { marginTop: 8 }]}>
                  Cottage food laws cover shelf-stable, non-TCS foods only. A cooked plate that needs refrigeration or hot-holding is not a cottage food. Produce, CSA shares, and cottage goods are listed in FarmGrownBasket, and that listing stays closed until you record your state rule, testing protocol, and permit fee.
                </Text>
                <Text style={styles.foodSafetyLink} onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)}>
                  Open the cottage food checklist
                </Text>
                <Text style={[styles.foodSafetyLink, { marginTop: 8 }]} onPress={() => router.push('/food-truck-popup/permit' as Href)}>
                  Food trucks list in FoodTruckPopup and need a mobile-unit permit
                </Text>
                <Text style={[styles.foodSafetyLink, { marginTop: 8 }]} onPress={() => router.push('/sit-down-delicious/license' as Href)}>
                  Independent restaurants list in SitDownDelicious and need a retail food license
                </Text>
                <Text style={[styles.foodSafetyLink, { marginTop: 8 }]} onPress={() => router.push('/kitchen-rules' as Href)}>
                  Kitchen rules for cooked plates and commissary kitchens
                </Text>
                <FoodHandlingLink label="Food handling temperatures, gloves, and containers" />
              </View>
            </View>
            <Pressable
              style={styles.acknowledgmentCheckboxRow}
              onPress={() => setFoodSafetyAcknowledged(!foodSafetyAcknowledged)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: foodSafetyAcknowledged }}
              testID="publish-food-safety"
            >
              <View style={[styles.acknowledgmentCheckbox, foodSafetyAcknowledged && styles.acknowledgmentCheckboxActive]}>
                {foodSafetyAcknowledged && <Text style={styles.acknowledgmentCheckmark}>✓</Text>}
              </View>
              <Text style={styles.acknowledgmentText}>
                I acknowledge that I have reviewed cottagefoodlaws.com and understand that I must comply with all local, county, state and federal food laws. I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
              </Text>
            </Pressable>
          </View>

          {missing.length > 0 ? (
            <View style={styles.missingBox} testID="publish-missing">
              <Text style={styles.missingTitle}>Still needed</Text>
              {missing.map((item) => (
                <Text key={item} style={styles.missingItem}>{item}</Text>
              ))}
            </View>
          ) : null}

          <GradientButton
            title={saving ? 'Publishing…' : 'Publish'}
            onPress={saveMeal}
            disabled={!isValid || saving}
            loading={saving}
            baseColor="red"
            testID="publish-meal"
          />
        </ScrollView>
      </SafeAreaView>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pagePastel.red },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  subtitle: { fontSize: 16, color: Colors.gray[700], marginBottom: 16, lineHeight: 22 },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: { fontSize: 14, color: Colors.warning, lineHeight: 20 },
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
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
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
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  missingBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  missingTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  missingItem: { fontSize: 14, color: Colors.gray[700], lineHeight: 20 },
});
