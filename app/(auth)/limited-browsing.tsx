import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AuthColors, maroonButtonColors, preAppFont } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand } from '@/components/auth/AuthChrome';
import { OrderHoursSlogan } from '@/components/OrderHoursSlogan';
import { GlassPressable, GlassTop, glassSurface } from '@/components/glass-surface';

const ORDER_PHOTO = require('../../assets/order-a-plate.png');
const COOK_PHOTO = require('../../assets/start-cooking.png');
const APPSOLETE_MARK = require('../../assets/appsolete-mark.jpg');

type Role = 'platetaker' | 'platemaker';

const CHOICES: { role: Role; label: string; roleName: string; photo: number; imageStyle: 'plate' | 'cook' }[] = [
  { role: 'platetaker', label: 'Order a Plate', roleName: 'PlateTaker', photo: ORDER_PHOTO, imageStyle: 'plate' },
  { role: 'platemaker', label: 'Start Cooking', roleName: 'PlateMaker', photo: COOK_PHOTO, imageStyle: 'cook' },
];

export default function LimitedBrowsingScreen() {
  const openNearYou = () => {
    router.push({ pathname: '/(auth)/welcome', params: { step: '0', entry: 'landing' } });
  };

  return (
    <AuthBackground testID="limited-browsing-screen">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.brandSlot}>
            <AuthBrand toSignIn={false} />
          </View>

          <View style={styles.doors}>
            {CHOICES.map((choice) => (
              <GlassPressable
                key={choice.role}
                style={styles.door}
                onPress={openNearYou}
                accessibilityRole="button"
                accessibilityLabel="Role selection"
                testID={`limited-photo-${choice.role}`}
              >
                <View style={styles.doorClip}>
                  <Image
                    source={choice.photo}
                    style={choice.imageStyle === 'cook' ? styles.doorImageCook : styles.doorImage}
                    resizeMode="cover"
                    accessible={false}
                  />
                </View>
              </GlassPressable>
            ))}
          </View>

          <OrderHoursSlogan style={styles.slogan} />

          <View style={styles.panel}>
            <GlassTop />
            <Text style={styles.panelTitle}>Membership</Text>
            <Text style={styles.help}>
              Choose how you will use HomeCookedPlate. Membership follows that choice.
            </Text>
            <View style={styles.choiceRow}>
              {CHOICES.map((choice) => {
                return (
                  <GlassPressable
                    key={choice.role}
                    style={styles.choiceButton}
                    onPress={openNearYou}
                    accessibilityRole="button"
                    accessibilityLabel={`${choice.label}, ${choice.roleName}`}
                    testID={`limited-role-${choice.role}`}
                  >
                    <LinearGradient
                      colors={[...maroonButtonColors]}
                      locations={[0, 0.42, 1]}
                      style={styles.choiceFill}
                    />
                    <Text style={styles.choiceLabel}>{choice.label}</Text>
                    <Text style={styles.choiceRole}>{choice.roleName}</Text>
                  </GlassPressable>
                );
              })}
            </View>
            <GlassPressable
              onPress={() => router.push({ pathname: '/(auth)/login', params: { from: 'landing' } })}
              accessibilityRole="button"
              accessibilityLabel="Already a member?"
              testID="already-a-member"
              style={styles.memberLink}
            >
              <Text style={styles.memberLinkText}>Already a member?</Text>
            </GlassPressable>
          </View>

          <View style={styles.credit}>
            <View style={styles.creditLogoWrap}>
              <Image source={APPSOLETE_MARK} style={styles.creditLogo} resizeMode="cover" accessibilityLabel="Appsolete AI" />
            </View>
            <Text style={styles.creditText}>Powered by Appsolete AI</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 28,
  },
  brandSlot: {
    paddingHorizontal: 20,
  },
  doors: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  door: {
    flex: 1,
    height: 148,
    borderRadius: 18,
    backgroundColor: '#6B2A12',
    ...glassSurface,
  },
  doorClip: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  doorImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  doorImageCook: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '-5%',
    width: '100%',
    height: '128%',
  },
  slogan: {
    color: AuthColors.ink,
    marginTop: 18,
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  panel: {
    marginHorizontal: 16,
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    ...glassSurface,
  },
  panelTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 10,
  },
  help: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceButton: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 18,
    minHeight: 88,
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...glassSurface,
  },
  choiceFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  choiceLabel: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  choiceRole: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  notice: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
  memberLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  memberLinkText: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  credit: {
    alignItems: 'center',
    marginTop: 28,
    gap: 12,
  },
  creditLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
  },
  creditLogo: {
    width: 64,
    height: 64,
  },
  creditText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
  },
});
