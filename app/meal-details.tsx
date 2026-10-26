import React, { useEffect, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { SellerOnly } from '@/components/RoleGuard';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { FoodImage } from '@/components/FoodImage';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { GradientButton } from '@/components/GradientButton';
import { Colors, pagePastel } from '@/constants/colors';
import { cuisineTypes } from '@/mocks/data';
import { trpc } from '@/lib/trpc';
import { parseIngredientList, portionsFromTags } from '@/lib/meal-publish';
import { deviceTimeZone } from '@/lib/pickup-time';
import { useMeals } from '@/hooks/meals-context';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? '';
}

export default function MealDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const mealId = typeof params.id === 'string' ? params.id : '';
  const mealQuery = trpc.meals.get.useQuery(
    { id: mealId },
    { enabled: mealId.length > 0 },
  );
  const updateDetails = trpc.meals.updateDetails.useMutation();
  const { updateMealDetails } = useMeals();
  const [cuisine, setCuisine] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [expiry, setExpiry] = useState('');
  const [receipt, setReceipt] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [portions, setPortions] = useState('1');
  const [filled, setFilled] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const data = mealQuery.data;
    if (!data || filled || data.isSample) return;
    setCuisine(data.cuisine || '');
    setIngredients((data.ingredients || []).join(', '));
    setExpiry(dateInput(data.expiryDate));
    setReceipt(dateInput(data.receiptDate));
    setPortions(String(portionsFromTags(data.tags)));
    setFilled(true);
  }, [mealQuery.data, filled]);

  const leave = useLeaveScreen('/(tabs)/dashboard');

  const addPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is needed for a freshness photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setPhotos((current) => [...current, uri]);
  };

  const save = async () => {
    const portionCount = Math.round(Number(portions));
    if (!Number.isInteger(portionCount) || portionCount < 1 || portionCount > 100) {
      setErrorText('Portions are a whole number from 1 to 100.');
      return;
    }
    const list = parseIngredientList(ingredients);
    const expiryDate = expiry.trim();
    const receiptDate = receipt.trim();
    if (!cuisine.trim() || list.length === 0 || (!expiryDate && !receiptDate)) {
      setErrorText('Choose a category, list the ingredients, and add an expiration date or a receipt date.');
      return;
    }
    if ((expiryDate && !DATE.test(expiryDate)) || (receiptDate && !DATE.test(receiptDate))) {
      setErrorText('Use dates as YYYY-MM-DD.');
      return;
    }
    setErrorText('');
    try {
      await updateDetails.mutateAsync({
        mealId,
        cuisine: cuisine.trim(),
        ingredients: list,
        expiryDate: expiryDate || undefined,
        receiptDate: receiptDate || undefined,
        portions: portionCount,
        cookTimeZone: deviceTimeZone(),
      });
      await updateMealDetails(mealId, {
        category: cuisine.trim(),
        ingredients: list,
        freshness: {
          expiryDate: expiryDate || undefined,
          receiptDate: receiptDate || undefined,
          attachments: photos.map((uri) => ({ uri, type: 'image' as const, addedAt: new Date() })),
        },
      });
      router.replace({ pathname: '/meal/[id]', params: { id: mealId } } as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save these details.';
      setErrorText(message);
    }
  };

  return (
    <SellerOnly>
      <SafeAreaView style={styles.screen} testID="meal-details">
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackCircle tone="honey" onPress={leave} testID="meal-details-back" />
          <Text style={styles.title}>Category, ingredients, and freshness</Text>
          <Text style={styles.subtitle}>Save a category, the ingredients, and a date. The plate stays off the menu until this is saved.</Text>

          {mealQuery.isLoading ? <ActivityIndicator color={Colors.gradient.green} /> : null}
          {mealQuery.error ? <Text style={styles.error}>This plate could not be opened.</Text> : null}

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {cuisineTypes.map((option) => (
              <GlassPressable
                key={option}
                onPress={() => setCuisine(option)}
                style={[styles.chip, cuisine === option && styles.chipOn]}
                testID={`detail-chip-${option}`}
              >
                <Text style={[styles.chipText, cuisine === option && styles.chipTextOn]}>{option}</Text>
              </GlassPressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Ingredients</Text>
          <TextInput
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Chicken, cream, garlic"
            placeholderTextColor={Colors.gray[400]}
            style={[styles.input, styles.area]}
            multiline
            testID="detail-ingredients"
          />

          <Text style={styles.label}>Portions</Text>
          <TextInput
            value={portions}
            onChangeText={setPortions}
            placeholder="1"
            placeholderTextColor={Colors.gray[400]}
            keyboardType="number-pad"
            style={styles.input}
            testID="detail-portions"
          />
          <Text style={styles.helper}>Open paid orders keep the portions they already hold.</Text>

          <Text style={styles.label}>Expiration date</Text>
          <TextInput
            value={expiry}
            onChangeText={setExpiry}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
            testID="detail-expiry"
          />
          <Text style={styles.label}>Receipt date</Text>
          <TextInput
            value={receipt}
            onChangeText={setReceipt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
            testID="detail-receipt"
          />
          <Text style={styles.helper}>One of the two dates is enough.</Text>

          <GlassPressable onPress={addPhoto} style={styles.photoButton} testID="detail-freshness-photo">
            <Text style={styles.photoButtonText}>Add a freshness photo</Text>
          </GlassPressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {photos.map((uri) => (
              <FoodImage key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>

          {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
          <GradientButton
            title={updateDetails.isPending ? 'Saving…' : 'Save details'}
            onPress={save}
            disabled={updateDetails.isPending || mealId.length === 0}
            loading={updateDetails.isPending}
            baseColor="red"
            testID="detail-save"
          />
          <GlassPressable onPress={leave} testID="detail-skip">
            <Text style={styles.skip}>Skip for later</Text>
          </GlassPressable>
        </ScrollView>
      </SafeAreaView>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pagePastel.red },
  content: { padding: 20, paddingBottom: 48 },
  back: { color: Colors.gray[800], fontWeight: '700', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  subtitle: { color: Colors.gray[700], marginBottom: 16, lineHeight: 20 },
  label: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6, marginTop: 8 },
  helper: { color: Colors.gray[600], marginBottom: 12 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  chips: { gap: 8, paddingBottom: 8 },
  chip: {
    ...glassSurface,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: '#9A3412' },
  chipText: { color: Colors.gray[800], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  photoButton: { marginTop: 8, marginBottom: 8 },
  photoButtonText: { color: '#9A3412', fontWeight: '700' },
  photos: { gap: 8, marginBottom: 12 },
  photo: { width: 72, height: 72, borderRadius: 10 },
  error: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  skip: { textAlign: 'center', marginTop: 14, color: Colors.gray[700], fontWeight: '700' },
});
