import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { openFoodHandling } from '@/components/FoodHandlingLink';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { screenName } from '@/lib/title-case';
import { useAuth } from '@/hooks/auth-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfilePhotoCapture, type CapturedPhoto } from '@/components/ProfilePhotoCapture';
import * as WebBrowser from 'expo-web-browser';
import { trpc } from '@/lib/trpc';
import { GlassPressable } from '@/components/glass-surface';
import { ScrollJumps } from '@/components/ScrollJumps';
import { GetGpsCard } from '@/components/GetGpsCard';

function savedProfilePhoto(uri?: string | null): string | null {
  if (!uri || !uri.includes('/storage/v1/object/public/profile-images/')) return null;
  return uri;
}

function tell(message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert('Profile photo', message);
}

export default function ProfileScreen() {
  const pathname = usePathname();
  const { user, logout, updateProfile, setOrderingAsBuyer } = useAuth();
  const accountRole = user?.accountRole ?? user?.role;
  const orderingAsBuyer = user?.orderingAsBuyer === true;
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const uploadPhoto = trpc.media.uploadProfile.useMutation();
  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      Alert.alert('Success', 'Food safety acknowledgment updated');
    },
  });

  const handleAcknowledgmentUpdate = async (acknowledged: boolean) => {
    if (!user || accountRole !== 'platemaker') return;
    try {
      await updateProfileMutation.mutateAsync({
        foodSafetyAcknowledged: acknowledged,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update acknowledgment';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        logout().then(() => router.replace('/(auth)/login'));
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const membershipTier = user?.membershipTier || 'free';
  const adminRole = user?.adminRole ?? (user?.isAdmin ? 'main' : null);
  const scrollRef = useRef<ScrollView>(null);

  const menuItems: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress: () => void;
    subtitle?: string;
    disabled?: boolean;
  }[] = [
    {
      icon: 'star-outline',
      title: 'Membership',
      onPress: () => router.push('/membership'),
      subtitle: membershipTier === 'premium' ? 'Premium Member' : 'Free Member',
    },
    {
      icon: 'videocam-outline',
      title: 'FoodReviewClips',
      subtitle: '9:16 food clips · smile, heart, star',
      onPress: () => router.push('/food-review-clips' as Href),
    },
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy & Security',
      onPress: () => router.push('/privacy-security'),
    },
    {
      icon: 'document-text-outline',
      title: 'Legal & Safety',
      onPress: () => router.push('/legal'),
    },
    {
      icon: 'thermometer-outline',
      title: 'Food Handling',
      subtitle: 'Clean, separate, cook, and chill',
      onPress: () => openFoodHandling(pathname),
    },
    ...(accountRole === 'platemaker'
      ? [{
          icon: 'restaurant-outline' as const,
          title: 'Kitchen Rules',
          onPress: () => router.push('/kitchen-rules' as Href),
        }]
      : []),
    {
      icon: 'heart-outline',
      title: 'Charitable gifts',
      subtitle: 'Unhoused people, elders, and children',
      onPress: () => router.push('/charitable-gifts' as Href),
    },
    ...(accountRole === 'platemaker'
      ? [{
          icon: 'pricetag-outline' as const,
          title: 'Area offers',
          subtitle: '1% to 50% off, or up to $100 off',
          onPress: () => router.push('/area-offers' as Href),
        }]
      : []),
    {
      icon: 'home-outline',
      title: 'Home Kitchens',
      subtitle: 'Plates cooked near you',
      onPress: () => router.push('/(tabs)/(home)/home' as Href),
    },
    {
      icon: 'leaf-outline',
      title: 'FarmGrownBasket',
      subtitle: 'Farms, gardens, and pickup',
      onPress: () => router.push('/farm-grown-basket' as Href),
    },
    {
      icon: 'nutrition-outline',
      title: 'MealPrepGo',
      subtitle: 'Meals built for the week',
      onPress: () => router.push('/meal-prep-go' as Href),
    },
    {
      icon: 'people-outline',
      title: 'CaterEventDeliver',
      subtitle: 'Group drop-off for offices and events',
      onPress: () => router.push('/cater-event-deliver' as Href),
    },
    {
      icon: 'bus-outline',
      title: 'FoodTruckPopup',
      subtitle: 'Order ahead for the service window',
      onPress: () => router.push('/food-truck-popup' as Href),
    },
    {
      icon: 'cafe-outline',
      title: 'SitDownDelicious',
      subtitle: 'Independent sit-down shops, takeout, and ghost kitchens',
      onPress: () => router.push('/sit-down-delicious' as Href),
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => router.push('/help-support'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      onPress: () => router.push('/settings'),
    },
    {
      icon: 'shield-outline',
      title: 'Admin',
      subtitle: adminRole === 'main'
        ? 'Main admin'
        : adminRole === 'monitor'
          ? 'Monitor admin'
          : 'Only admins have access',
      disabled: !adminRole,
      onPress: () => {
        if (adminRole === 'main') router.push('/admin-dashboard' as Href);
        if (adminRole === 'monitor') router.push('/admin-monitor' as Href);
      },
    },
  ];

  const photo = localPreview || savedProfilePhoto(user?.profileImage);

  const saveCameraPhoto = async (captured: CapturedPhoto | null) => {
    setCameraOpen(false);
    if (!captured) return;
    setLocalPreview(`data:${captured.mimeType};base64,${captured.base64}`);
    setSavingPhoto(true);
    try {
      const uploaded = await uploadPhoto.mutateAsync({
        base64Data: captured.base64,
        mimeType: captured.mimeType,
      });
      await updateProfile({ profileImage: uploaded.uri });
      await utils.auth.me.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That photo was not accepted. Take a new one with the camera.';
      tell(message);
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={42} color={Colors.gray[500]} />
              </View>
            )}
            <GlassPressable
              testID="profile-camera"
              style={styles.cameraButton}
              onPress={() => setCameraOpen(true)}
              disabled={savingPhoto}
              accessibilityLabel="Take a profile photo with the camera"
            >
              <Ionicons name="camera" size={18} color={Colors.white} />
            </GlassPressable>
          </View>
          <Text style={styles.name}>{screenName(user?.username)}</Text>
          <Text style={styles.email}>{user?.email || 'guest@example.com'}</Text>
          <View style={[styles.roleTag, { 
            backgroundColor: accountRole === 'platemaker' ? Colors.gradient.green : Colors.gradient.yellow,
            borderWidth: 2,
            borderColor: accountRole === 'platemaker' ? Colors.gradient.yellow : Colors.gradient.green,
          }]}>
            <Text style={styles.roleText}>
              {accountRole === 'platemaker' ? 'platemaker' : 'platetaker'}
            </Text>
          </View>
          {accountRole === 'platemaker' ? (
            <View style={styles.orderSwitch}>
              <View style={styles.orderSwitchText}>
                <Text style={styles.orderSwitchTitle}>Order food</Text>
                <Text style={styles.orderSwitchSubtitle}>
                  {orderingAsBuyer
                    ? 'Ordering is on. Home, cart, and checkout follow a PlateTaker. Turn this off to cook again.'
                    : 'Turn this on to order from other cooks. Your account stays a PlateMaker.'}
                </Text>
              </View>
              <Switch
                testID="order-as-buyer"
                value={orderingAsBuyer}
                onValueChange={(on) => {
                  setOrderingAsBuyer(on).then(() => {
                    router.push(on ? '/(tabs)/(home)/home' : '/(tabs)/dashboard');
                  });
                }}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
                accessibilityLabel="Order food as a PlateTaker"
              />
            </View>
          ) : null}
          
          {/* Membership Badge */}
          <View style={styles.membershipBadgeContainer}>
            <LinearGradient
              colors={membershipTier === 'premium' ? monoGradients.gold : [Colors.gray[400], Colors.gray[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.membershipBadge}
            >
              <Ionicons
                name={membershipTier === 'premium' ? 'diamond' : 'person'}
                size={16}
                color={Colors.white}
              />
              <Text style={styles.membershipText}>
                {membershipTier === 'premium' ? 'Premium' : 'Free'}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {cameraOpen ? <ProfilePhotoCapture onDone={saveCameraPhoto} /> : null}

        {accountRole === 'platemaker' ? <GetGpsCard /> : null}

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <GlassPressable
              key={index}
              style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
              onPress={item.onPress}
              disabled={item.disabled}
              accessibilityState={{ disabled: Boolean(item.disabled) }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={22} color={item.disabled ? Colors.gray[400] : Colors.gray[600]} />
                <View style={styles.menuItemTextContainer}>
                  <Text style={[styles.menuItemText, item.disabled && styles.menuItemTextDisabled]}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
            </GlassPressable>
          ))}
        </View>

        {accountRole === 'platemaker' && (
          <View style={styles.foodSafetySection}>
            <View style={styles.foodSafetyHeader}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.gradient.green} />
              <Text style={styles.foodSafetyTitle}>Food Safety Acknowledgment</Text>
            </View>
            <View style={styles.foodSafetyContent}>
              <Text style={styles.foodSafetyDescription}>
                We recommend every Platemaker review{' '}
                <Text
                  style={styles.foodSafetyLink}
                  onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
                >
                  cottagefoodlaws.com
                </Text>
                {' '}and do your due diligence to meet all food safety requirements from your local, county, state and federal laws before selling food items on the HomeCookedPlate App.
              </Text>
              <Text style={[styles.foodSafetyDescription, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
                HomeCookedPlate is not affiliated or in partnership with cottagefoodlaws.com.
              </Text>
              <Text
                style={[styles.foodSafetyLink, { marginTop: 8 }]}
                onPress={() => router.push('/kitchen-rules' as Href)}
              >
                Kitchen rules for cooked plates, MEHKO, and commissary kitchens
              </Text>
              <View style={styles.acknowledgmentStatusContainer}>
                <View style={styles.acknowledgmentStatusRow}>
                  <Ionicons
                    name={user?.foodSafetyAcknowledged ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={user?.foodSafetyAcknowledged ? Colors.gradient.green : Colors.gradient.orange}
                  />
                  <Text style={styles.acknowledgmentStatusText}>
                    Status: {user?.foodSafetyAcknowledged ? 'Acknowledged' : 'Not Acknowledged'}
                  </Text>
                </View>
                {!user?.foodSafetyAcknowledged && (
                  <GlassPressable
                    style={styles.acknowledgmentButton}
                    onPress={() => handleAcknowledgmentUpdate(true)}
                    disabled={updateProfileMutation.isPending}
                  >
                    <Text style={styles.acknowledgmentButtonText}>
                      {updateProfileMutation.isPending ? 'Updating...' : 'Acknowledge Now'}
                    </Text>
                  </GlassPressable>
                )}
              </View>
              <View style={styles.acknowledgmentDisclaimerBox}>
                <Text style={styles.acknowledgmentDisclaimerText}>
                  I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
                </Text>
              </View>
            </View>
          </View>
        )}

        <GlassPressable testID="logout-button" style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.gradient.red} />
          <Text style={styles.logoutText}>Logout</Text>
        </GlassPressable>
      </ScrollView>
      <ScrollJumps scrollRef={scrollRef} testID="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pagePastel.gold,
  },
  scrollContent: {
    paddingBottom: 108,
  },
  menuItemDisabled: {
    opacity: 0.45,
  },
  menuItemTextDisabled: {
    color: Colors.gray[500],
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  avatarWrap: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray[200],
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gradient.green,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 12,
  },
  roleTag: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
  },
  orderSwitch: {
    alignSelf: 'stretch',
    marginTop: 16,
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  orderSwitchText: {
    flex: 1,
  },
  orderSwitchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  orderSwitchSubtitle: {
    fontSize: 13,
    color: Colors.gray[600],
    marginTop: 4,
  },
  roleText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[50],
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.gray[900],
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: Colors.gray[600],
    marginTop: 2,
  },
  membershipBadgeContainer: {
    marginTop: 12,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  membershipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginVertical: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gradient.red,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gradient.red,
  },
  foodSafetySection: {
    marginHorizontal: 24,
    marginVertical: 24,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  foodSafetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  foodSafetyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  foodSafetyContent: {
    gap: 16,
  },
  foodSafetyDescription: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  foodSafetyLink: {
    color: Colors.gradient.green,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  acknowledgmentStatusContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  acknowledgmentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  acknowledgmentStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  acknowledgmentButton: {
    backgroundColor: Colors.gradient.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  acknowledgmentButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  acknowledgmentDisclaimerBox: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    padding: 12,
  },
  acknowledgmentDisclaimerText: {
    fontSize: 13,
    color: Colors.gray[700],
    lineHeight: 18,
    fontStyle: 'italic',
  },
});