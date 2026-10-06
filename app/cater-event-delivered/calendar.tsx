import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { CATER_COMPANIES } from '@/constants/cater-event-delivered';
import { stateName } from '@/lib/cottage-food';

export default function CaterCalendarScreen() {
  return (
    <CaterEventScreen title="Drop-off calendar" subtitle="Posted windows. The company still has to be accepting orders." testID="cater-calendar">
      <Text style={styles.lead}>
        A calendar shows when a catering company plans to drop off. It does not place the order. Checkout asks for the organization, the address, and one of these windows.
      </Text>
      {CATER_COMPANIES.map((company) => (
        <View key={company.id} style={styles.card}>
          <Text style={styles.name}>{company.name}</Text>
          <Text style={styles.meta}>{company.city}, {stateName(company.stateCode)} · {company.accepting ? 'Accepting drop-offs' : 'Not accepting'}</Text>
          {company.windows.map((window) => (
            <Text key={`${company.id}-${window.day}-${window.hours}`} style={styles.stop}>{window.day} · {window.hours} · {window.place}</Text>
          ))}
          <Text style={styles.stop}>{company.dropoffNote}</Text>
          <TouchableOpacity onPress={() => router.push(`/cater-event-delivered/company/${company.id}` as Href)}>
            <Text style={styles.link}>Open the company</Text>
          </TouchableOpacity>
        </View>
      ))}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[700], lineHeight: 20 },
  card: { marginTop: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4 },
  stop: { color: Colors.gray[700], marginTop: 6, lineHeight: 20 },
  link: { color: '#6D28D9', fontWeight: '700', marginTop: 8 },
});
