import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { getCompany, packagesForCompany } from '@/constants/cater-event-deliver';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { stateName } from '@/lib/cottage-food';
import { useAuth } from '@/hooks/auth-context';

export default function CaterCompanyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Array.isArray(id) ? id[0] : id;
  const company = companyId ? getCompany(companyId) : undefined;
  const { follows, toggleFollow } = useCaterEvent();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  if (!company) {
    return (
      <CaterEventScreen title="Catering company" testID="cater-company-missing">
        <Text>That company is not on the board.</Text>
      </CaterEventScreen>
    );
  }

  return (
    <CaterEventScreen title={titleCase(company.name)} subtitle={`${company.city}, ${stateName(company.stateCode)}`} testID="cater-company">
      <Image source={{ uri: company.image }} style={styles.hero} />
      <Text style={[styles.status, company.accepting ? styles.open : styles.closed]}>
        {company.accepting ? 'Accepting drop-offs' : 'Not accepting orders'}
      </Text>
      <Text style={styles.body}>{company.summary}</Text>
      <Text style={styles.meta}>{company.county} County · {company.zip} · {company.focus}</Text>
      <Text style={styles.body}>{company.dropoffNote}</Text>
      <GlassPressable style={styles.follow} onPress={() => toggleFollow(company.id)} testID="cater-follow">
        <Text style={styles.followText}>{follows.includes(company.id) ? 'Following This Company' : 'Follow This Company'}</Text>
      </GlassPressable>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Posted windows</Text>
        {company.windows.map((window) => (
          <Text key={`${window.day}-${window.place}`} style={styles.body}>{window.day} · {window.hours} · {window.place}</Text>
        ))}
        <Text style={styles.body}>A window on the calendar is a plan. The order goes through only while the company is accepting drop-offs.</Text>
        {isMaker ? (
          <GlassPressable onPress={() => router.push('/cater-event-deliver/license' as Href)}>
            <Text style={styles.link}>Catering License Checklist</Text>
          </GlassPressable>
        ) : null}
      </View>
      <Text style={styles.section}>Packages</Text>
      {packagesForCompany(company.id).map((item) => (
        <GlassPressable key={item.id} style={styles.row} onPress={() => router.push(`/cater-event-deliver/package/${item.id}` as Href)}>
          <Text style={styles.name}>{titleCase(item.name)}</Text>
          <Text style={styles.meta}>${item.pricePerPerson.toFixed(2)} per person · minimum {item.minimumHeadcount} · {company.accepting ? 'Order' : 'Not accepting'}</Text>
        </GlassPressable>
      ))}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  hero: { ...glassSurface, width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.gray[200]  },
  status: { marginTop: 10, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  meta: { color: Colors.gray[500], marginTop: 4 },
  follow: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#6D28D9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  followText: { color: Colors.white, fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  panelTitle: { fontWeight: '700', color: Colors.gray[900] },
  link: { color: '#6D28D9', fontWeight: '700', marginTop: 8 },
  section: { marginTop: 18, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  row: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginTop: 8 },
  name: { fontWeight: '700', color: Colors.gray[900] },
});
