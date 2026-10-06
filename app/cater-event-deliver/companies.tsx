import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { CATER_COMPANIES, companiesNearZip } from '@/constants/cater-event-deliver';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { stateName } from '@/lib/cottage-food';

export default function CaterCompaniesScreen() {
  const [zip, setZip] = useState('');
  const { follows } = useCaterEvent();
  const companies = companiesNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;
  const list = searching ? companies : CATER_COMPANIES;

  return (
    <CaterEventScreen title="Catering companies" subtitle="Group packages. Not the cooked-plate feed." testID="cater-directory">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="Search by ZIP"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="companies-zip"
      />
      {searching && list.length === 0 ? <Text style={styles.empty}>No catering company matches that ZIP.</Text> : null}
      {list.map((company) => (
        <TouchableOpacity key={company.id} style={styles.card} onPress={() => router.push(`/cater-event-deliver/company/${company.id}` as Href)} testID={`company-card-${company.id}`}>
          <Image source={{ uri: company.image }} style={styles.image} />
          <View style={styles.copy}>
            <Text style={styles.name}>{company.name}</Text>
            <Text style={styles.meta}>{company.city}, {stateName(company.stateCode)} {company.zip}</Text>
            <Text style={styles.meta}>{company.accepting ? 'Accepting drop-offs' : 'Not accepting'} · {company.focus}</Text>
            {follows.includes(company.id) ? <Text style={styles.follow}>Following</Text> : null}
          </View>
        </TouchableOpacity>
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
    marginBottom: 12,
  },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10 },
  image: { width: 88, height: 88, borderRadius: 12, backgroundColor: Colors.gray[200] },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  follow: { marginTop: 6, color: '#6D28D9', fontWeight: '700', fontSize: 12 },
  empty: { color: Colors.gray[600], marginBottom: 12 },
});
