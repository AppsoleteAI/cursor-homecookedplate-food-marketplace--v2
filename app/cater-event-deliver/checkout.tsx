import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { getCompany, getPackage } from '@/constants/cater-event-deliver';
import { useAuth } from '@/hooks/auth-context';
import { useCaterEvent, type CaterOrderLine } from '@/hooks/cater-event-store';
import { DROP_OFF_WINDOWS, type DropOffWindow } from '@/lib/cater-event-license';
import { calculateOrderSplit } from '@/lib/fees';

export default function CaterCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, license, accepting, placeOrder } = useCaterEvent();
  const [dropoffWindow, setDropoffWindow] = useState<DropOffWindow>('Weekday lunch, 11:00–1:00');
  const [organization, setOrganization] = useState('');
  const [address, setAddress] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [block, setBlock] = useState<string | null>(null);

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getPackage(item.packageId);
      const listing = listings.find((entry) => entry.id === item.packageId);
      const name = catalog?.name ?? listing?.name;
      const pricePerPerson = catalog?.pricePerPerson ?? listing?.pricePerPerson;
      const minimum = catalog?.minimumHeadcount ?? listing?.minimumHeadcount ?? 8;
      if (!name || pricePerPerson === undefined) return [];
      const line: CaterOrderLine & { minimum: number } = {
        packageId: item.packageId,
        name,
        headcount: item.headcount,
        pricePerPerson,
        minimum,
      };
      return [line];
    });
  }, [items, listings]);

  const companyId = items[0]?.companyId ?? '';
  const catalogCompany = getCompany(companyId);
  const companyName = companyId === 'owner-company' ? license?.companyName ?? 'Your company' : catalogCompany?.name ?? 'Catering company';
  const open = companyId === 'owner-company' ? accepting : Boolean(catalogCompany?.accepting);
  const baseAmount = lines.reduce((sum, line) => sum + line.pricePerPerson * line.headcount, 0);
  const split = calculateOrderSplit(baseAmount);
  const shortHeadcount = lines.find((line) => line.headcount < line.minimum);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const place = () => {
    if (!open || lines.length === 0) return;
    if (organization.trim().length < 2) {
      setBlock('Name the organization this order is for. Spend is tracked under that name.');
      return;
    }
    if (address.trim().length < 8) {
      setBlock('Enter the drop-off address, including a suite or room if the trays need one.');
      return;
    }
    if (shortHeadcount) {
      setBlock(`${shortHeadcount.name} needs at least ${shortHeadcount.minimum} people.`);
      return;
    }
    setBlock(null);
    const order = placeOrder({
      companyId,
      companyName,
      organization: organization.trim(),
      dropoffWindow,
      address: address.trim(),
      lines: lines.map(({ packageId, name, headcount, pricePerPerson }) => ({ packageId, name, headcount, pricePerPerson })),
      baseAmount,
      buyerPays: split.totalCaptured,
      sellerPayout: split.sellerPayout,
    });
    setOrderId(order.id);
  };

  if (orderId) {
    return (
      <CaterEventScreen title="Drop-off booked" subtitle={organization.trim() || 'Organization order'} showOrder={false} testID="cater-checkout-done">
        <Text style={styles.lead}>{companyName} has order {orderId}. They drop off and set up during {dropoffWindow}. Nothing is sent to a courier from this app.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/cater-event-deliver/orders' as Href)}>
          <Text style={styles.buttonText}>Catering orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}>
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate maker dashboard' : 'Buyer dashboard'}</Text>
        </TouchableOpacity>
      </CaterEventScreen>
    );
  }

  return (
    <CaterEventScreen title="Catering checkout" subtitle="Drop-off and setup. Same fee split as the rest of the app." testID="cater-checkout">
      {lines.length === 0 ? (
        <TouchableOpacity onPress={() => router.push('/cater-event-deliver/board' as Href)}>
          <Text style={styles.link}>Choose a company that is accepting orders.</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <Text style={styles.company}>{companyName}</Text>
          {lines.map((line) => (
            <Text key={line.packageId} style={styles.line}>{line.headcount} people × {line.name}</Text>
          ))}
        </View>
      )}
      {!open && lines.length > 0 ? <Text style={styles.block}>This company is not accepting drop-offs. Check the calendar and come back when they are.</Text> : null}
      <Text style={styles.section}>Organization</Text>
      <TextInput
        value={organization}
        onChangeText={setOrganization}
        placeholder="Office, clinic, or event host"
        placeholderTextColor={Colors.gray[400]}
        style={styles.input}
        testID="cater-organization"
      />
      <Text style={styles.section}>Drop-off address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="Street, suite, and city"
        placeholderTextColor={Colors.gray[400]}
        style={[styles.input, styles.area]}
        multiline
        testID="cater-address"
      />
      <Text style={styles.section}>Drop-off window</Text>
      {DROP_OFF_WINDOWS.map((option) => (
        <TouchableOpacity key={option} style={[styles.option, dropoffWindow === option && styles.optionOn]} onPress={() => setDropoffWindow(option)}>
          <Text style={[styles.optionText, dropoffWindow === option && styles.optionTextOn]}>{option}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <Text style={styles.note}>The catering company arranges drop-off and tray setup. A 15% to 25% marketplace commission is not added.</Text>
      {block ? <Text style={styles.block}>{block}</Text> : null}
      <TouchableOpacity
        style={[styles.button, (!open || lines.length === 0) && styles.buttonOff]}
        disabled={!open || lines.length === 0}
        onPress={place}
        testID="place-cater-order"
      >
        <Text style={styles.buttonText}>Place catering order</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Cooked-plate checkout</Text>
      </TouchableOpacity>
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 22, fontSize: 16 },
  company: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  line: { color: Colors.gray[800], marginBottom: 4 },
  block: { color: '#9F1239', marginTop: 8, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#6D28D9' },
  optionText: { color: Colors.gray[800], fontWeight: '600' },
  optionTextOn: { color: Colors.white },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginVertical: 4 },
  note: { marginTop: 10, color: Colors.gray[600], lineHeight: 20 },
  button: { marginTop: 14, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white },
  secondaryText: { color: '#6D28D9', fontWeight: '700' },
  link: { marginTop: 12, color: '#6D28D9', fontWeight: '700' },
});
