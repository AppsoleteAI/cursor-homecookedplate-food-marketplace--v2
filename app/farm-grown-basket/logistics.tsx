import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { LOGISTICS_MODELS } from '@/constants/farm-grown-basket';
import { channelLabel } from '@/lib/cottage-food';

export default function LogisticsScreen() {
  return (
    <FarmScreen title="Pickup and delivery" subtitle="Choose a handoff at farm checkout." testID="farm-logistics">
      <Text style={styles.lead}>
        FarmGrownBasket does not mail cottage food. Interstate shipping of homemade food is heavily limited, so checkout offers local handoffs only. A hub route is for whole produce, grain, and eggs, not for jam, bread, honey, or other cottage foods.
      </Text>
      {LOGISTICS_MODELS.map((model) => (
        <View key={model.id} style={styles.card}>
          <Text style={styles.title}>{model.title}</Text>
          <Text style={styles.body}>{model.detail}</Text>
          {model.channels.map((channel) => (
            <Text key={channel} style={styles.channel}>{channelLabel(channel)}</Text>
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={() => router.push('/farm-grown-basket/checkout' as Href)} testID="logistics-to-checkout">
        <Text style={styles.buttonText}>Continue to farm checkout</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Plate checkout is a different screen, for cooked plates only.</Text>
      </TouchableOpacity>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[700], lineHeight: 20 },
  card: { marginTop: 14, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  body: { marginTop: 6, color: Colors.gray[700], lineHeight: 20 },
  channel: { marginTop: 6, color: '#166534', fontWeight: '600' },
  button: { marginTop: 16, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '600', lineHeight: 20 },
});
