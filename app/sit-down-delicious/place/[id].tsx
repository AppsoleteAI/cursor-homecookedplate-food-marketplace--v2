import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { SHOP_KIND_LABEL, getPlace, menuForPlace } from '@/constants/sit-down-delicious';
import { useSitDown } from '@/hooks/sit-down-store';
import { useAuth } from '@/hooks/auth-context';
import { stateName } from '@/lib/cottage-food';
import { SERVICE_LABEL } from '@/lib/sit-down-license';

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const placeId = Array.isArray(id) ? id[0] : id;
  const place = placeId ? getPlace(placeId) : undefined;
  const { follows, toggleFollow } = useSitDown();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  if (!place) {
    return (
      <SitDownScreen title="Place" testID="place-missing">
        <Text>That restaurant is not in the directory.</Text>
      </SitDownScreen>
    );
  }

  return (
    <SitDownScreen title={titleCase(place.name)} subtitle={`${place.city}, ${stateName(place.stateCode)}`} testID="sit-place">
      <Image source={{ uri: place.image }} style={styles.hero} />
      <Text style={[styles.status, place.openNow ? styles.open : styles.closed]}>{place.openNow ? 'Open for orders' : 'Closed today'}</Text>
      <Text style={styles.body}>{place.summary}</Text>
      <Text style={styles.meta}>{SHOP_KIND_LABEL[place.kind]} · {place.street}</Text>
      <Text style={styles.meta}>{place.county} County · {place.zip} · {place.hours}</Text>
      <Text style={styles.body}>{place.services.map((service) => SERVICE_LABEL[service]).join(' or ')}. Pickup is at this address. A courier is not part of this order.</Text>
      <GlassPressable style={styles.follow} onPress={() => toggleFollow(place.id)} testID="place-follow">
        <Text style={styles.followText}>{follows.includes(place.id) ? 'On Your Neighborhood List' : 'Keep This Shop on Your List'}</Text>
      </GlassPressable>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Licensed at this address</Text>
        <Text style={styles.body}>The retail food permit belongs to this street. Cottage food law and a food-truck permit do not authorize this kitchen. Rank on this list is not for sale.</Text>
        {isMaker ? (
          <GlassPressable onPress={() => router.push('/sit-down-delicious/license' as Href)}>
            <Text style={styles.link}>Retail Food License Checklist</Text>
          </GlassPressable>
        ) : null}
      </View>
      <Text style={styles.section}>Menu</Text>
      {menuForPlace(place.id).map((item) => (
        <GlassPressable key={item.id} style={styles.row} onPress={() => router.push(`/sit-down-delicious/item/${item.id}` as Href)}>
          <Text style={styles.name}>{titleCase(item.name)}</Text>
          <Text style={styles.meta}>${item.price.toFixed(2)} · {place.openNow ? 'Order now' : 'Shop closed'}</Text>
        </GlassPressable>
      ))}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  hero: { ...glassSurface, width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.gray[200]  },
  status: { marginTop: 10, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9A3412' },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  meta: { color: Colors.gray[500], marginTop: 4 },
  follow: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#92400E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  followText: { color: Colors.white, fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  panelTitle: { fontWeight: '700', color: Colors.gray[900] },
  link: { color: '#92400E', fontWeight: '700', marginTop: 8 },
  section: { marginTop: 18, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  row: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginTop: 8 },
  name: { fontWeight: '700', color: Colors.gray[900] },
});
