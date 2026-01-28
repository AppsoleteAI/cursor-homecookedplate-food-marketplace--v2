import React, { useMemo, useState, useCallback } from 'react';
import { SellerOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';


import { router, useFocusEffect } from 'expo-router';

import { useOrders } from '@/hooks/orders-context';
import { useAuth } from '@/hooks/auth-context';
import * as WebBrowser from 'expo-web-browser';

export default function DashboardScreen() {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const insets = useSafeAreaInsets();
  const { activeOrdersCount, todayEarnings, weekEarnings, totalReviews, orders, refresh } = useOrders();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      refresh().catch(err => console.error('[Dashboard] refresh on focus error', err));
      return () => {};
    }, [refresh])
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setUploadedImages([...uploadedImages, result.assets[0].uri]);
      Alert.alert('Success', 'Image uploaded successfully!');
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setUploadedImages([...uploadedImages, result.assets[0].uri]);
      Alert.alert('Success', 'Photo uploaded successfully!');
    }
  };

  const stats = useMemo(() => ({
    todayEarnings: todayEarnings,
    weekEarnings: weekEarnings,
    activeOrders: activeOrdersCount,
    totalReviews: totalReviews,
  }), [todayEarnings, weekEarnings, activeOrdersCount, totalReviews]);

  return (
    <SellerOnly>
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
                <Text style={styles.title}>PlateMaker Dashboard</Text>
                <Text style={styles.subtitle}>Manage your meals and orders</Text>
              </View>

          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
        >

        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} testID="card-today-earnings" onPress={() => router.push('/finance/today')}>
            <Ionicons name="cash-outline" size={24} color={Colors.gradient.green} />
            <Text style={styles.statValue}>${stats.todayEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today&apos;s Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} testID="card-week-earnings" onPress={() => router.push('/finance/periods')}>
            <Ionicons name="trending-up-outline" size={24} color={Colors.gradient.green} />
            <Text style={styles.statValue}>${stats.weekEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} testID="card-earnings-breakdown" onPress={() => router.push('/finance/earnings')}>
            <Ionicons name="receipt-outline" size={24} color={Colors.gradient.green} />
            <Text style={styles.statValue}>$</Text>
            <Text style={styles.statLabel}>Earnings Breakdown</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} testID="card-active-orders" onPress={() => {
            try {
              router.push('/active-orders');
            } catch (error) {
              console.error('[dashboard] Error navigating to active orders:', error);
            }
          }}>
            <Ionicons name="cube-outline" size={24} color={Colors.gradient.green} />
            <Text style={styles.statValue}>{stats.activeOrders}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} testID="card-reviews" onPress={() => router.push('/reviews-dashboard')}>
            <Ionicons name="star-outline" size={24} color={Colors.gradient.green} />
            <Text style={styles.statValue}>{stats.totalReviews}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </TouchableOpacity>
        </View>

        {user && !user.foodSafetyAcknowledged && (
          <View style={styles.foodSafetyBanner}>
            <View style={styles.foodSafetyBannerHeader}>
              <Ionicons name="warning" size={24} color={Colors.gradient.orange} />
              <Text style={styles.foodSafetyBannerTitle}>Food Safety Acknowledgment Required</Text>
            </View>
            <Text style={styles.foodSafetyBannerText}>
              We recommend every Platemaker review{' '}
              <Text
                style={styles.foodSafetyBannerLink}
                onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
              >
                cottagefoodlaws.com
              </Text>
              {' '}and do your due diligence to meet all food safety requirements from your local, county, state and federal laws before selling food items. You must acknowledge this requirement before publishing meals.
            </Text>
            <Text style={[styles.foodSafetyBannerText, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
              HomeCookedPlate is not affiliated or in partnership with cottagefoodlaws.com.
            </Text>
            <TouchableOpacity
              style={styles.foodSafetyBannerButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.foodSafetyBannerButtonText}>Acknowledge Now</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Document Ingredients</Text>
          <Text style={styles.uploadDescription}>
            Add photos and track ingredient freshness with receipt or expiration dates
          </Text>

          <View style={styles.uploadButtons}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={24} color={Colors.gradient.green} />
              <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color={Colors.gradient.green} />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {uploadedImages.length > 0 && (
            <View style={styles.imagePreview}>
              <Text style={styles.previewTitle}>Recent Uploads</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageScroll}
              >
                {uploadedImages.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.previewImage} />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Add Expiration Dates</Text>
            <Text style={styles.uploadDescription}>Quickly log freshness for key ingredients</Text>
            <View style={{ flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[styles.expChip, { borderColor: Colors.gray[300] }]} testID="exp-chip-chicken">
                <Text style={styles.expChipText}>Chicken 2025-10-02</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.expChip, { borderColor: Colors.gray[300] }]} testID="exp-chip-tomatoes">
                <Text style={styles.expChipText}>Tomatoes 2025-10-03</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12 }}>
              <GradientButton title="Add Ingredient Freshness" onPress={() => Alert.alert('Add', 'Open ingredient freshness form')} baseColor="green" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Orders</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.viewAll}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {orders.filter(o => o.status !== 'completed').map(order => (
            <View key={order.id} style={styles.orderCard}>
              <Image source={{ uri: order.mealImage }} style={styles.orderImage} />
              <View style={styles.orderDetails}>
                <Text style={styles.orderName}>{order.mealName}</Text>
                <Text style={styles.orderQuantity}>Quantity: {order.quantity}</Text>
                <Text style={styles.orderStatus}>Status: {order.status}</Text>
              </View>
              <Text style={styles.orderPrice}>${order.totalPrice.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.addMealButton} testID="create-meal-cta">
          <GradientButton
            title="Create New Meal"
            onPress={() => router.push('/(tabs)/create-meal')}
            baseColor="green"
            testID="create-new-meal"
          />
        </View>
        </ScrollView>
      </View>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    margin: '1%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  uploadSection: {
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 16,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    borderStyle: 'dashed',
  },
  expChip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  expChipText: {
    color: Colors.gray[700],
    fontSize: 12,
    fontWeight: '600',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  imagePreview: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 12,
  },
  imageScroll: {
    gap: 12,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAll: {
    fontSize: 14,
    color: Colors.gradient.green,
    fontWeight: '600',
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  orderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  orderDetails: {
    flex: 1,
  },
  orderName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  orderQuantity: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 2,
  },
  orderStatus: {
    fontSize: 14,
    color: Colors.gradient.green,
    fontWeight: '600',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gradient.green,
  },
  addMealButton: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  foodSafetyBanner: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: Colors.gradient.orange + '10',
    borderWidth: 2,
    borderColor: Colors.gradient.orange,
    borderRadius: 16,
    padding: 16,
  },
  foodSafetyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  foodSafetyBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  foodSafetyBannerText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
    marginBottom: 16,
  },
  foodSafetyBannerLink: {
    color: Colors.gradient.green,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  foodSafetyBannerButton: {
    backgroundColor: Colors.gradient.orange,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  foodSafetyBannerButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});