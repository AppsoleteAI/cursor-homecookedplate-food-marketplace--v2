import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients, type BaseColor } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { BackCircle } from '@/components/BackCircle';
import { useReplaceBack } from '@/hooks/use-leave-screen';

const BUYER_PLACES: { name: string; detail: string; color: BaseColor }[] = [
  { name: 'Home Kitchens', detail: 'Plates cooked near you, for pickup.', color: 'yellow' },
  { name: 'FarmGrownBasket', detail: 'Produce, eggs, honey, and homemade goods. Pick them up from the farm.', color: 'green' },
  { name: 'MealPrepGo', detail: 'Heat-and-eat meals, cook-at-home kits, or a mix. Built for the week.', color: 'blue' },
  { name: 'CaterEventDeliver', detail: 'Per-person packages for offices, clinics, and events.', color: 'purple' },
  { name: 'FoodTruckPopup', detail: 'Independent food carts and food trucks. Order ahead and pick up at the window or the cart.', color: 'orange' },
  { name: 'SitDownDelicious', detail: 'Independent restaurants. Coffee, yogurt, ice cream, and small dining rooms. Sit down or take out.', color: 'gold' },
];

const COOK_PATH: { name: string; detail: string; color: BaseColor }[] = [
  { name: 'Home', detail: 'Start with plates from your own kitchen.', color: 'yellow' },
  { name: 'FarmGrownBasket', detail: 'Produce, eggs, honey, and homemade goods. Pickup is from the farm.', color: 'green' },
  { name: 'MealPrepGo', detail: 'A weekly plan from your kitchen. Ready meals, cook-at-home kits, or a mix.', color: 'blue' },
  { name: 'Catering', detail: 'CaterEventDeliver is group drop-off for offices, clinics, and events.', color: 'purple' },
  { name: 'FoodTruckPopup', detail: 'Independent food carts and food trucks. Customers order ahead and pick up at the cart or the service window.', color: 'orange' },
  { name: 'Restaurant', detail: 'SitDownDelicious is a licensed independent restaurant. Guests sit down or take out.', color: 'gold' },
];

export default function MembershipAccessScreen() {
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker';
  const places = isMaker ? COOK_PATH : BUYER_PLACES;
  const leave = useReplaceBack('/membership');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: isMaker ? 'Cook path' : 'Where to eat', headerShown: false }} />
      <View style={styles.backRow}>
        <BackCircle tone="honey" onPress={leave} testID="membership-access-back" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{isMaker ? 'Grow with the kitchen you have' : 'Plates from more than one place'}</Text>
        {isMaker ? (
          <Text style={styles.body}>
            The places a PlateTaker can order from are also places a cook can grow into. Home, FarmGrownBasket, MealPrepGo, Catering, FoodTruckPopup, and a Restaurant.
          </Text>
        ) : (
          <>
            <Text style={styles.body}>Congratulations. You now have access.</Text>
            {['Home Kitchens', 'Farms', 'Weekly Prep', 'Catering', 'Carts', 'Trucks', 'Restaurants'].map((section) => (
              <Text key={section} style={styles.bullet}>{`• ${section}`}</Text>
            ))}
            <Text style={styles.body}>
              Premium is $7.99 a month or $75.99 a year. It cuts the service fee on the receipt from 10% to 5% on orders of $20 or more.
            </Text>
          </>
        )}
        {places.map((place) => (
          <LinearGradient
            key={place.name}
            colors={monoGradients[place.color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.heading}>{place.name}</Text>
            <Text style={styles.cardBody}>{place.detail}</Text>
          </LinearGradient>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  backRow: { paddingHorizontal: 16, paddingTop: 8 },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.gray[700],
  },
  bullet: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.gray[900],
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.white,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
});
