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
  Switch,
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
import { trpc } from '@/lib/trpc';

export default function DashboardScreen() {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const insets = useSafeAreaInsets();
  const { activeOrdersCount, todayEarnings, weekEarnings, totalReviews, orders, refresh } = useOrders();
  const { user } = useAuth();

  // CRITICAL SECURITY: Only call backend procedure if user is platemaker
  // This prevents API calls from platetakers and ensures frontend never attempts to fetch data for non-platemakers
  const dashboardStats = trpc.platemaker.getDashboardStats.useQuery(undefined, {
    enabled: user?.role === 'platemaker' && !!user?.id,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Get availability status
  const availabilityStatus = trpc.platemaker.getAvailability.useQuery(undefined, {
    enabled: user?.role === 'platemaker' && !!user?.id,
    refetchOnWindowFocus: false,
  });

  // Toggle availability mutation
  const toggleAvailability = trpc.platemaker.toggleAvailability.useMutation({
    onSuccess: () => {
      availabilityStatus.refetch();
      Alert.alert(
        'Availability Updated',
        availabilityStatus.data?.available === false
          ? 'You are now accepting new orders'
          : 'You are no longer accepting new orders. Existing orders will continue.'
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update availability status');
    },
  });

  // Call hooks before any early returns
  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'platemaker') {
        refresh().catch(err => console.error('[Dashboard] refresh on focus error', err));
      }
      return () => {};
    }, [refresh, user?.role])
  );


  // Security: Never render earnings data if user role is not platemaker (guard should prevent this, but add defensive check)
  if (user?.role !== 'platemaker') {
    return null; // Defensive check - SellerOnly guard should prevent this, but safety first
  }

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

