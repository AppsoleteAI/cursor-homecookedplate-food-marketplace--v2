import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { useAuth } from '@/hooks/auth-context';

export default function MembershipAccessScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const joinFree = useCallback(() => {
    router.replace(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/(home)/home');
  }, [router, user?.role]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Joining', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>You can join free</Text>
        <Text style={styles.body}>
          Payment is not required to use HomeCookedPlate. Leave the $4.99 page and choose Join free.
        </Text>
        <View style={styles.card}>
          <Text style={styles.heading}>PlateTakers</Text>
          <Text style={styles.body}>
            PlateTakers use the app free. Premium is optional. It cuts the service fee on the receipt from 10% to 5% on orders of $20 or more.
          </Text>
          <Text style={styles.heading}>PlateMakers</Text>
          <Text style={styles.body}>
            A PlateMaker in an active metro that still has a spot can start 90 days of Premium with a card. The $4.99 monthly charge begins after those 90 days. Cancel before then and you are not charged.
          </Text>
          <Text style={styles.body}>
            Outside an active metro, those 90 days are not available. You can still join free.
          </Text>
        </View>
        <GradientButton title="Join free" onPress={joinFree} baseColor="green" />
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
    marginTop: 8,
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
