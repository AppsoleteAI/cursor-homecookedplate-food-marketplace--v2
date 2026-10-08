import React, { useState } from 'react';
import { Text, StyleSheet, TextInput } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { CATER_COMPANIES, companiesNearZip } from '@/constants/cater-event-deliver';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useAuth } from '@/hooks/auth-context';
import { stateName } from '@/lib/cottage-food';

export default function CaterBoardScreen() {
  const params = useLocalSearchParams<{ zip?: string }>();
  const initialZip = typeof params.zip === 'string' ? params.zip : '';
  const [zip, setZip] = useState(initialZip);
  const { license, accepting, listings } = useCaterEvent();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const companies = companiesNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;

  return (
    <CaterEventScreen title="Open for orders" subtitle="Accepting means a drop-off can be placed today." testID="cater-board">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="ZIP code"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="cater-board-zip"
      />
      <Text style={styles.note}>This board is the company’s own switch. It is not a live truck map, and a posted calendar does not by itself accept an order.</Text>
      {isMaker && license ? (
        <GlassPressable style={styles.card} onPress={() => router.push('/cater-event-deliver/seller' as Href)}>
          <Text style={styles.name}>{license.companyName}</Text>
          <Text style={[styles.status, accepting ? styles.open : styles.closed]}>{accepting ? 'Accepting drop-offs' : 'Not accepting'}</Text>
          <Text style={styles.meta}>{license.city}, {stateName(license.stateCode)} · {listings.length} package{listings.length === 1 ? '' : 's'}</Text>
        </GlassPressable>
      ) : null}
      <Text style={styles.section}>{searching ? 'Companies in this ZIP area' : 'On the board'}</Text>
      {(searching ? companies : CATER_COMPANIES).length === 0 ? <Text style={styles.note}>No catering company shares the first three digits of that ZIP.</Text> : null}
      {(searching ? companies : CATER_COMPANIES).map((company) => (
        <GlassPressable key={company.id} style={styles.card} onPress={() => router.push(`/cater-event-deliver/company/${company.id}` as Href)} testID={`board-company-${company.id}`}>
          <Text style={styles.name}>{titleCase(company.name)}</Text>
          <Text style={[styles.status, company.accepting ? styles.open : styles.closed]}>{company.accepting ? 'Accepting drop-offs' : 'Not accepting'}</Text>
          <Text style={styles.meta}>{company.city}, {stateName(company.stateCode)} · {company.focus}</Text>
          <Text style={styles.meta}>{company.windows[0]?.place} · {company.windows[0]?.hours}</Text>
        </GlassPressable>
      ))}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  note: { color: Colors.gray[600], marginTop: 10, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10  },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  status: { marginTop: 6, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  meta: { color: Colors.gray[600], marginTop: 4 },
});
