import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star, Clock, Tag, Percent, Gift } from 'lucide-react-native';
import { Meal } from '@/types';
import { Colors, monoGradients } from '@/constants/colors';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useReviewsContext } from '@/hooks/reviews-context';

interface MealCardProps {
  meal: Meal;
  onPress?: () => void;
  sizeVariant?: 'grid' | 'featured';
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onPress, sizeVariant = 'grid' }) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/meal/${meal.id}`);
    }
  };

  const { getAggregates } = useReviewsContext();
  const aggregates = useMemo(() => getAggregates(meal.id), [getAggregates, meal.id]);

  const getPromoIcon = () => {
    if (!meal.promotionalOffer) return null;
    switch (meal.promotionalOffer.type) {
      case 'percentage':
        return Percent;
      case 'buy-x-get-y':
        return Gift;
      case 'fixed-amount':
        return Tag;
      case 'free-item':
        return Gift;
      default:
        return Tag;
    }
  };

  const getPromoText = () => {
    if (!meal.promotionalOffer) return '';
    const offer = meal.promotionalOffer;
    switch (offer.type) {
      case 'percentage':
        return `${offer.discountPercentage}% OFF`;
      case 'fixed-amount':
        return `${offer.discountAmount} OFF`;
      case 'buy-x-get-y':
        return `Buy ${offer.buyQuantity} Get ${offer.getQuantity}`;
      case 'free-item':
        return `Free ${offer.freeItemName}`;
      default:
        return '';
    }
  };

  const isPromoActive = meal.promotionalOffer && 
    meal.promotionalOffer.isActive && 
    new Date() >= meal.promotionalOffer.startDate && 
    new Date() <= meal.promotionalOffer.endDate;

  const PromoIcon = getPromoIcon();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeVariant === 'featured' ? styles.containerFeatured : styles.containerGrid,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
      testID={`meal-card-${meal.id}`}
    >
      {meal.images && meal.images.length > 0 ? (
        <Image source={{ uri: meal.images[0] }} style={[styles.image, sizeVariant === 'featured' ? styles.imageFeatured : styles.imageGrid]} />
      ) : (
        <View style={[styles.image, sizeVariant === 'featured' ? styles.imageFeatured : styles.imageGrid, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No Image</Text>
        </View>
      )}
      {meal.featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>Featured</Text>
        </View>
      )}
      {!meal.featured && meal.rating >= 4.5 && (meal.reviewCount || 0) >= 3 && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>Popular</Text>
        </View>
      )}
      <View style={[styles.timeBadge, sizeVariant === 'featured' ? styles.timeBadgeFeatured : styles.timeBadgeGrid]}>
        <Clock size={12} color={Colors.gray[900]} />
        <Text style={styles.timeBadgeText}>{meal.preparationTime} min</Text>
      </View>
      {isPromoActive && PromoIcon && (
        <View style={styles.promoBadge}>
          <PromoIcon size={12} color={Colors.white} />
          <Text style={styles.promoText}>{getPromoText()}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={styles.plateMaker} numberOfLines={1}>
          {meal.plateMakerName}
        </Text>
        {(meal.dietaryOptions?.length ?? 0) > 0 && (
          <View style={styles.dietRow}>
            {meal.dietaryOptions.slice(0, 2).map((option) => (
              <View key={option} style={styles.dietChip}>
                <Text style={styles.dietChipText} numberOfLines={1}>{option}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.info}>
          <TouchableOpacity
            style={styles.rating}
            onPress={() => {
              const href = `/reviews/${meal.id}` as const;
              const next: Href = `/meal/${meal.id}` as const;
              router.push({ pathname: href, params: { next } } as any);
            }}
            testID={`open-reviews-${meal.id}`}
          >
            <Star size={14} color={Colors.gradient.yellow} fill={Colors.gradient.yellow} />
            <Text style={styles.ratingText}>{aggregates.average || meal.rating}</Text>
            <Text style={styles.reviewCount}>({aggregates.count || meal.reviewCount})</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.priceRow}>
          <LinearGradient
            colors={monoGradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.priceGradient}
          >
            <Text style={styles.price}>${meal.price.toFixed(2)}</Text>
          </LinearGradient>
          {isPromoActive && meal.promotionalOffer && (
            <View style={styles.promoTag}>
              <Text style={styles.promoTagText}>PROMO</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  containerGrid: {
    width: '48%',
  },
  containerFeatured: {
    width: '88%',
    minWidth: '88%',
  },
  image: {
    width: '100%',
    backgroundColor: Colors.gray[200],
  },
  imageGrid: {
    height: 120,
  },
  imageFeatured: {
    height: 160,
  },
  imagePlaceholder: {
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: Colors.gray[500],
    fontWeight: '500',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.gradient.orange,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  featuredText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    backgroundColor: Colors.white,
  },
  dietRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  dietChip: {
    backgroundColor: Colors.gray[100],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '48%',
  },
  dietChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  timeBadge: {
    position: 'absolute',
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeBadgeGrid: {
    top: 88,
  },
  timeBadgeFeatured: {
    top: 124,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  plateMaker: {
    fontSize: 13,
    color: Colors.gray[600],
    marginBottom: 10,
    fontWeight: '500',
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
    letterSpacing: -0.1,
  },
  reviewCount: {
    fontSize: 12,
    color: Colors.gray[500],
    fontWeight: '500',
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.gray[600],
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  promoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.gradient.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  promoText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  promoTag: {
    backgroundColor: Colors.gradient.green + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoTagText: {
    color: Colors.gradient.green,
    fontSize: 10,
    fontWeight: '700',
  },
});