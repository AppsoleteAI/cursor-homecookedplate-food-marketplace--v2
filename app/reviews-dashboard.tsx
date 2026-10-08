import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import StarRating from '@/components/StarRating';
import { router, type Href } from 'expo-router';

export default function ReviewsDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const myMeals = trpc.meals.myMeals.useQuery(undefined, {
    enabled: user?.role === 'platemaker',
  });
  const reviewQuery = trpc.reviews.list.useQuery(undefined, { enabled: !!user });
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  const mealsById = useMemo(() => {
    const map = new Map<string, { name: string; image?: string }>();
    for (const meal of myMeals.data || []) {
      map.set(meal.id, { name: meal.name, image: meal.media?.[0]?.uri });
    }
    return map;
  }, [myMeals.data]);

  const relevantMealIds = useMemo(() => new Set(mealsById.keys()), [mealsById]);

  const reviews = useMemo(() => {
    return (reviewQuery.data || [])
      .filter((review) => user?.role !== 'platemaker' || relevantMealIds.has(review.mealId))
      .map((review) => ({
        id: review.id,
        mealId: review.mealId,
        user: review.authorName,
        rating: review.rating,
        comment: review.comment || '',
        date: review.createdAt,
      }));
  }, [reviewQuery.data, relevantMealIds, user?.role]);

  const filtered = useMemo(() => {
    const base = reviews
      .filter(r => relevantMealIds.has(r.mealId))
      .sort((a,b) => (a.date < b.date ? 1 : -1));
    const byStar = starFilter ? base.filter(r => Math.round(r.rating) === starFilter) : base;
    return byStar.slice(0, 5);
  }, [reviews, relevantMealIds, starFilter]);

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1:0,2:0,3:0,4:0,5:0 };
    reviews.filter(r => relevantMealIds.has(r.mealId)).forEach(r => {
      const k = Math.round(r.rating) as 1|2|3|4|5;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [reviews, relevantMealIds]);

  return (
    <View style={styles.container}>
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.green}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height ?? 0;
            if (h !== headerHeight) {
              setHeaderHeight(h);
            }
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Reviews</Text>
            <Text style={styles.subtitle}>Most recent 5 • Filter by stars</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
      >
        <View style={styles.filters}>
          <GlassPressable
            testID="open-food-review-clips"
            onPress={() => router.push('/food-review-clips' as Href)}
            style={styles.clipsLink}
          >
            <Text style={styles.clipsLinkText}>FoodReviewClips · 😊 ❤️ ⭐</Text>
          </GlassPressable>
          <View style={styles.filterRow}>
            {[5, 4, 3].map(s => {
              const active = starFilter === s;
              return (
                <GlassPressable
                  key={`star-${s}`}
                  onPress={() => setStarFilter(active ? null : s)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  testID={`filter-star-${s}`}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{s}★ ({counts[s] ?? 0})</Text>
                </GlassPressable>
              );
            })}
          </View>
          <View style={styles.filterRow}>
            {[2, 1].map(s => {
              const active = starFilter === s;
              return (
                <GlassPressable
                  key={`star-${s}`}
                  onPress={() => setStarFilter(active ? null : s)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  testID={`filter-star-${s}`}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{s}★ ({counts[s] ?? 0})</Text>
                </GlassPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.empty} testID="reviews-empty">
              <Text style={styles.emptyText}>No reviews found</Text>
            </View>
          ) : (
            filtered.map(r => {
              const meal = mealsById.get(r.mealId);
              return (
                <View key={r.id} style={styles.reviewCard}>
                  {meal?.image ? <Image source={{ uri: meal.image }} style={styles.mealImage} /> : null}
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.user}>{r.user}</Text>
                      <StarRating value={r.rating} size={14} baseColor="yellow" disabled />
                    </View>
                    <Text numberOfLines={3} style={styles.comment}>{r.comment}</Text>
                    <Text style={styles.date}>{new Date(r.date).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pagePastel.green,
  },
  staticHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  filters: {
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  clipsLink: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[900],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  clipsLinkText: {
    color: Colors.white,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  filterChipActive: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[900],
  },
  filterText: {
    color: Colors.gray[700],
    fontWeight: '600',
    fontSize: 14,
  },
  filterTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  list: {
    marginTop: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  empty: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.gray[500],
  },
  reviewCard: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  mealImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  user: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  comment: {
    fontSize: 14,
    color: Colors.gray[700],
    marginTop: 4,
  },
  date: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 6,
  },
});
