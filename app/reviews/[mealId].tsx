import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TextInput, Alert } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { useLocalSearchParams } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import StarRating from '@/components/StarRating';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-context';
import { GlassPressable } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { trpc } from '@/lib/trpc';
import { ReviewCommentActions } from '@/components/ReviewCommentActions';
import { chosenReviewOrder, ordersLeftToReview } from '@/lib/review-order';

export default function ReviewsScreen() {
  const params = useLocalSearchParams<{ mealId: string; next?: string; initialRating?: string }>();
  const mealId = params.mealId;
  const { user } = useAuth();
  const mealQuery = trpc.meals.get.useQuery(
    { id: mealId ?? '', metroArea: user?.metroArea || undefined },
    { enabled: !!mealId }
  );
  const meal = mealQuery.data;
  const reviewQuery = trpc.reviews.list.useQuery(
    { mealId: mealId ?? undefined },
    { enabled: !!mealId }
  );
  const buyerOrders = trpc.orders.list.useQuery(
    { role: 'buyer' },
    { enabled: !!mealId && user?.role === 'platetaker' }
  );
  const utils = trpc.useUtils();
  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      reviewQuery.refetch();
      utils.meals.get.invalidate();
      utils.meals.list.invalidate();
    },
  });
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const role: 'platemaker' | 'platetaker' | undefined = (user?.role as any);
  const isPlatemaker = role === 'platemaker';
  const scrollRef = useRef<ScrollView | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);
  const leave = useLeaveScreen(mealId ? (`/meal/${mealId}` as const) : null);
  const reviewedOrderIds = (reviewQuery.data || [])
    .filter((review) => review.authorId === user?.id && typeof review.orderId === 'string')
    .map((review) => review.orderId as string);
  const reviewChoices = ordersLeftToReview(buyerOrders.data || [], mealId || '', reviewedOrderIds);

  useEffect(() => {
    const initial = Number(params.initialRating ?? 0);
    if (!Number.isNaN(initial) && initial > 0 && initial <= 5) {
      setRating(initial);
    }
  }, [params.initialRating]);

  const submit = () => {
    if (!mealId) return;
    if (!rating) {
      Alert.alert('Select rating', 'Please select a star rating to continue.');
      return;
    }
    const choices = ordersLeftToReview(buyerOrders.data || [], mealId, reviewedOrderIds);
    const completedOrder = chosenReviewOrder(choices, selectedOrderId);
    if (!completedOrder) {
      Alert.alert(
        'Order required',
        choices.length > 1
          ? 'Choose which completed order this review is for.'
          : 'You can review a plate after that order is completed.',
      );
      return;
    }
    createReview.mutate(
      { mealId, orderId: completedOrder.id, rating, comment },
      {
        onSuccess: () => {
          setRating(0);
          setComment('');
          setJustSubmitted(true);
        },
        onError: (error) => {
          Alert.alert('Review not posted', error.message);
        },
      }
    );
    try {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }
      return;
    } catch (e) {
      console.error('Failed to handle post-submit UI', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={monoGradients.yellow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient} />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header]}>
          <BackCircle tone="light" onPress={leave} testID="reviews-back" />
          <Text style={styles.title}>Reviews</Text>
          {meal && <Text style={styles.subtitle}>{titleCase(meal.name)}</Text>}
        </View>

        {meal && (
          <View style={styles.mealCard}>
            <Image source={{ uri: meal.images?.[0] }} style={styles.mealImage} />
            <View style={styles.mealInfo}>
              <Text style={styles.mealName} numberOfLines={1}>{titleCase(meal.name)}</Text>
              <Text style={styles.plateMaker} numberOfLines={1}>{meal.plateMakerName}</Text>
              <StarRating value={Math.round(meal.rating)} baseColor="yellow" size={16} disabled />
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>What people are saying</Text>
        <View style={styles.list}>
          {(reviewQuery.data || []).map(r => (
            <View key={r.id} style={styles.review}>
              {!!r.authorImage && <Image source={{ uri: r.authorImage }} style={styles.avatar} />}
              <View style={styles.reviewBody}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.user}>{r.authorName}</Text>
                  <StarRating value={r.rating} baseColor="yellow" size={14} disabled />
                </View>
                <Text style={styles.comment}>{r.comment}</Text>
                <ReviewCommentActions
                  reviewId={r.id}
                  authorId={r.authorId}
                  comment={r.comment || ''}
                  onChanged={() => reviewQuery.refetch()}
                />
                <Text style={styles.date}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPlatemaker && (
          <>
            <Text style={styles.sectionTitle}>Add your review</Text>
            <View style={styles.inputCard}>
              {reviewChoices.length > 1 ? (
                <View style={styles.orderChoices}>
                  <Text style={styles.orderChoiceLabel}>Choose the completed order</Text>
                  {reviewChoices.map((order) => {
                    const selected = order.id === selectedOrderId;
                    const when = order.orderDate ? new Date(order.orderDate) : null;
                    const label = when && !Number.isNaN(when.getTime())
                      ? when.toLocaleDateString()
                      : 'Completed order';
                    return (
                      <GlassPressable
                        key={order.id}
                        style={[styles.orderChoice, selected && styles.orderChoiceOn]}
                        onPress={() => setSelectedOrderId(order.id)}
                        testID={`review-order-${order.id}`}
                      >
                        <Text style={[styles.orderChoiceText, selected && styles.orderChoiceTextOn]}>
                          {label}{order.quantity && order.quantity > 1 ? ` · ${order.quantity} plates` : ''}
                        </Text>
                      </GlassPressable>
                    );
                  })}
                </View>
              ) : null}
              <StarRating value={rating} onChange={setRating} baseColor="yellow" />
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Share details about your experience..."
                placeholderTextColor={Colors.gray[400]}
                style={styles.input}
                multiline
                numberOfLines={4}
                maxLength={200}
                testID="review-input"
              />
              <GlassPressable style={styles.submitButton} onPress={submit} testID="submit-review">
                <Text style={styles.submitText}>Submit Review</Text>
              </GlassPressable>
              {justSubmitted && (
                <View style={styles.successNote} testID="review-success">
                  <Text style={styles.successText}>Thanks! Your review was posted.</Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  scrollContent: { paddingBottom: 80 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 16, color: Colors.white, marginTop: 4 },
  mealCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, backgroundColor: Colors.white, borderRadius: 12, padding: 12, elevation: 1 },
  mealImage: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  plateMaker: { fontSize: 12, color: Colors.gray[600], marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.gray[900], marginTop: 20, marginBottom: 12, paddingHorizontal: 24 },
  list: { paddingHorizontal: 24, gap: 12 },
  review: { flexDirection: 'row', backgroundColor: Colors.gray[50], borderRadius: 12, padding: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  reviewBody: { flex: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  user: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  comment: { fontSize: 14, color: Colors.gray[700], lineHeight: 20 },
  date: { fontSize: 12, color: Colors.gray[500], marginTop: 6 },
  inputCard: { marginHorizontal: 24, marginTop: 8, backgroundColor: Colors.gray[50], borderRadius: 12, padding: 12 },
  orderChoices: { gap: 8, marginBottom: 12 },
  orderChoiceLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray[700] },
  orderChoice: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  orderChoiceOn: { borderColor: monoGradients.yellow[0], backgroundColor: '#FFF8E8' },
  orderChoiceText: { fontSize: 14, color: Colors.gray[800] },
  orderChoiceTextOn: { fontWeight: '700', color: Colors.gray[900] },
  input: { marginTop: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: Colors.gray[900] },
  submitButton: { marginTop: 12, backgroundColor: monoGradients.yellow[0], paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: Colors.white, fontWeight: '700' },
  successNote: { marginTop: 8, alignItems: 'center' },
  successText: { color: Colors.gray[600], fontSize: 12 },
  bottomSpacer: { height: 24 },
});
