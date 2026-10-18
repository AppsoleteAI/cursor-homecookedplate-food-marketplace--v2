import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';

const BUYER_PLACES = [
  ['Home kitchens', 'Plates cooked near you, for pickup.'],
  ['FarmGrownBasket', 'Produce, eggs, honey, and homemade goods. Pick them up from the farm.'],
  ['MealPrepGo', 'Heat-and-eat meals, cook-at-home kits, or a mix. Built for the week.'],
  ['CaterEventDeliver', 'Per-person packages for offices, clinics, and events.'],
  ['FoodTruckPopup', 'Independent food carts and food trucks. Order ahead and pick up at the window or the cart.'],
  ['SitDownDelicious', 'Independent restaurants. Coffee, yogurt, ice cream, and small dining rooms. Sit down or take out.'],
] as const;

const COOK_PATH = [
  ['Home', 'Start with plates from your own kitchen.'],
  ['Catering', 'CaterEventDeliver is group drop-off for offices, clinics, and events.'],
  ['Cart', 'An independent food cart on FoodTruckPopup. Pickup is at the cart.'],
  ['Truck', 'An independent food truck on FoodTruckPopup. Pickup is at the service window.'],
  ['Restaurant', 'SitDownDelicious is a licensed independent restaurant. Guests sit down or take out.'],
] as const;

export default function MembershipAccessScreen() {
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker';
  const places = isMaker ? COOK_PATH : BUYER_PLACES;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: isMaker ? 'Cook path' : 'Where to eat', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{isMaker ? 'Grow with the kitchen you have' : 'Plates from more than one place'}</Text>
        <Text style={styles.body}>
          {isMaker
            ? 'The places a PlateTaker can order from are also places a cook can grow into. Home plates come first. Catering, a cart, a truck, and a restaurant come after, each with its own license.'
            : 'You already have access. Look through home kitchens, then farms, weekly prep, catering, carts, trucks, and restaurants. Premium is a choice if you want the lower service fee.'}
        </Text>
        {places.map(([name, detail]) => (
          <View key={name} style={styles.card}>
            <Text style={styles.heading}>{name}</Text>
            <Text style={styles.body}>{detail}</Text>
          </View>
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
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.gray[700],
  },
  card: {
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
});
