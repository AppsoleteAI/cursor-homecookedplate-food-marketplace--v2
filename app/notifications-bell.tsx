import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, monoGradients } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useOrders } from '@/hooks/orders-context';

interface SimpleNotification {
  id: string;
  title: string;
  body: string;
  date: string;
}

export default function NotificationsBellScreen() {
  const { getNotificationItems } = useOrders();

  const notifications: SimpleNotification[] = useMemo(() => {
    const base = getNotificationItems();
    return base.map(it => ({ id: it.id, title: it.title, body: it.body, date: it.date }));
  }, [getNotificationItems]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={monoGradients.yellow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="notifications" size={22} color={Colors.white} />
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} testID="close-notifications-bell">
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Your recent alerts</Text>
      </LinearGradient>

      {notifications.length === 0 ? (
        <View style={styles.emptyState} testID="notifications-empty">
          <Ionicons name="notifications-outline" size={48} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>You are all caught up! We will let you know when something changes.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((n) => (
            <View key={n.id} style={styles.item} testID={`notification-${n.id}`}>
              <View style={styles.itemLeft}>
                <View style={styles.itemIcon}>
                  <Ionicons name="notifications" size={18} color={Colors.gradient.yellow} />
                </View>
                <View style={styles.itemTexts}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemBody}>{n.body}</Text>
                </View>
              </View>
              <Text style={styles.itemDate}>{new Date(n.date).toLocaleString()}</Text>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.white },
  headerSubtitle: { marginTop: 6, color: Colors.white, opacity: 0.9 },
  closeText: { color: Colors.white, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[800] },
  emptySubtitle: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },
  list: { padding: 16 },
  item: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff7e6', alignItems: 'center', justifyContent: 'center' },
  itemTexts: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: Colors.gray[900] },
  itemBody: { fontSize: 13, color: Colors.gray[600], marginTop: 2 },
  itemDate: { fontSize: 11, color: Colors.gray[500], marginLeft: 8 },
});