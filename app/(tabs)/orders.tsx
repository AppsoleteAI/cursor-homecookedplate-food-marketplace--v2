import React, { useState } from 'react';
import { BuyerOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, monoGradients } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trpc, trpcProxyClient } from '@/lib/trpc';
import { useAuth } from '@/hooks/auth-context';
import { useCart } from '@/hooks/cart-context';
import { useFavorites } from '@/hooks/favorites-context';
import { useRouter } from 'expo-router';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const [reorderingMealId, setReorderingMealId] = useState<string | null>(null);

  const { data: orders, isLoading, error, refetch } = trpc.orders.list.useQuery(
    { role: 'buyer' },
    {
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    }
  );

  const handleReorder = async (order: NonNullable<typeof orders>[0]) => {
    if (!order) return;
    
    try {
      setReorderingMealId(order.mealId);
      
      // Fetch full meal details
      const meal = await trpcProxyClient.meals.get.query({ id: order.mealId });
      
      // Check availability
      if (!meal.available) {
        Alert.alert('Unavailable', 'This meal is no longer available');
        setReorderingMealId(null);
        return;
      }
      
      // Add to cart with original preferences
      addToCart(meal, order.quantity, {
        specialInstructions: order.specialInstructions,
        allergies: order.allergies,
        cookingTemperature: order.cookingTemperature,
        pickupTime: order.pickupTime,
      });
      
      // Show success and navigate to cart
      Alert.alert('Success', 'Meal added to cart!', [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
      ]);
    } catch (error) {
      console.error('[Re-order] Error:', error);
      Alert.alert('Error', 'Failed to re-order. Please try again.');
    } finally {
      setReorderingMealId(null);
    }
  };

  const handleToggleFavorite = async (order: NonNullable<typeof orders>[0]) => {
    if (!order) return;
    
    try {
      // Fetch meal to toggle favorite
      const meal = await trpcProxyClient.meals.get.query({ id: order.mealId });
      toggleFavorite(meal);
    } catch (error) {
      console.error('[Toggle Favorite] Error:', error);
      Alert.alert('Error', 'Failed to update favorite. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'accepted':
        return Colors.info;
      case 'preparing':
        return Colors.info;
      case 'ready':
        return Colors.success;
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.gray[500];
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (user?.role === 'platemaker') {
    return <BuyerOnly />;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.gray[400]} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Failed to load orders: {error.message}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <BuyerOnly>
      <View style={styles.container}>
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={monoGradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          />
          <View style={styles.header}>
            <Text style={styles.title}>Your Orders</Text>
            <Text style={styles.subtitle}>Track your meal orders and history</Text>
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
        >
          {!orders || orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>Your order history will appear here</Text>
            </View>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <Image
                  source={{ uri: order.mealImage || 'https://via.placeholder.com/150' }}
                  style={styles.orderImage}
                />
                <View style={styles.orderContent}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderName} numberOfLines={2}>
                      {order.mealName}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.plateMakerName}>by {order.plateMakerName}</Text>
                  <View style={styles.orderDetails}>
                    <Text style={styles.orderDetailText}>Quantity: {order.quantity}</Text>
                    {order.pickupTime && (
                      <Text style={styles.orderDetailText}>
                        Pickup: {new Date(order.pickupTime).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  {order.specialInstructions && (
                    <Text style={styles.instructionsText} numberOfLines={2}>
                      Instructions: {order.specialInstructions}
                    </Text>
                  )}
                  {order.allergies && order.allergies.length > 0 && (
                    <Text style={styles.allergiesText} numberOfLines={1}>
                      Allergies: {order.allergies.join(', ')}
                    </Text>
                  )}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={() => handleToggleFavorite(order)}
                      style={styles.favoriteButton}
                    >
                      <Ionicons
                        name={isFavorite(order.mealId) ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isFavorite(order.mealId) ? Colors.gradient.red : Colors.gray[600]}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleReorder(order)}
                      disabled={reorderingMealId === order.mealId}
                      style={[
                        styles.reorderButton,
                        reorderingMealId === order.mealId && styles.reorderButtonDisabled,
                      ]}
                    >
                      {reorderingMealId === order.mealId ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <LinearGradient
                          colors={monoGradients.green}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.reorderGradient}
                        >
                          <Text style={styles.reorderText}>Re-order</Text>
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.priceContainer}>
                  <LinearGradient
                    colors={monoGradients.gold}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.priceGradient}
                  >
                    <Text style={styles.priceText}>${order.totalPrice.toFixed(2)}</Text>
                  </LinearGradient>
                  <Text style={styles.orderDate}>
                    {new Date(order.orderDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </BuyerOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.gray[600],
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
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
  },
  scrollContent: {
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: Colors.gray[100],
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderImage: {
    width: 100,
    height: 100,
    backgroundColor: Colors.gray[200],
  },
  orderContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  orderName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  plateMakerName: {
    fontSize: 12,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  orderDetailText: {
    fontSize: 12,
    color: Colors.gray[600],
  },
  instructionsText: {
    fontSize: 11,
    color: Colors.gray[500],
    fontStyle: 'italic',
    marginTop: 4,
  },
  allergiesText: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 4,
  },
  priceContainer: {
    padding: 12,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  orderDate: {
    fontSize: 10,
    color: Colors.gray[500],
  },
  bottomSpacer: {
    height: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  reorderButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  reorderButtonDisabled: {
    opacity: 0.6,
  },
  reorderGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
});
