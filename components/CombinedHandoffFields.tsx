import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { combinedChargeKey } from '@/lib/gather-combined-checkouts';
import { fulfillmentIsDelivery } from '@/backend/lib/delivery-fee';
import { shopFulfillmentSchema, type ShopFulfillment } from '@/backend/lib/shop-fulfillment';
import { DeliveryLevyLines, useDeliveryQuote } from '@/components/DeliveryFeeCard';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { getCompany, getPackage } from '@/constants/cater-event-deliver';
import { getCatalogProduct, getFarm } from '@/constants/farm-grown-basket';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { getPrepCook, getPrepItem } from '@/constants/meal-prep-go';
import { getPlace, getSitItem } from '@/constants/sit-down-delicious';
import { DROP_OFF_WINDOWS } from '@/lib/cater-event-license';
import { buyerChannelBlock, channelLabel, channelWarning, FARM_CHANNELS, type FarmChannel, type RegulatoryTrack } from '@/lib/cottage-food';
import { PICKUP_SLOTS } from '@/lib/food-truck-permit';
import type { CombinedCheckoutDraft } from '@/lib/gather-combined-checkouts';
import { weekMix } from '@/lib/meal-prep-go';
import { SERVICE_LABEL, type DiningService } from '@/lib/sit-down-license';

const PARTY = [1, 2, 3, 4, 5, 6, 8, 10, 12];

type HandoffReport = {
  key: string;
  handoff: ShopFulfillment | null;
  block: string | null;
  deliveryFee: number;
  deliveryLoading: boolean;
};

function windowLabel(day: string, hours: string, place: string): string {
  return `${day} ${hours} · ${place}`;
}

export function CombinedHandoffFields({
  draft,
  onChange,
}: {
  draft: CombinedCheckoutDraft;
  onChange: (report: HandoffReport) => void;
}) {
  const key = combinedChargeKey(draft.area, draft.sellerId);
  const catalog = useMemo(() => resolveCatalog(draft), [draft]);
  const [channel, setChannel] = useState<FarmChannel>('farm_pickup');
  const [prepHandoff, setPrepHandoff] = useState<'pickup' | 'dropoff'>('pickup');
  const [prepWindow, setPrepWindow] = useState('');
  const [prepAddress, setPrepAddress] = useState('');
  const [pickupSlot, setPickupSlot] = useState<(typeof PICKUP_SLOTS)[number]>(PICKUP_SLOTS[0]);
  const [organization, setOrganization] = useState('');
  const [dropoffWindow, setDropoffWindow] = useState<(typeof DROP_OFF_WINDOWS)[number]>(DROP_OFF_WINDOWS[0]);
  const [caterAddress, setCaterAddress] = useState('');
  const [service, setService] = useState<DiningService>(catalog.services[0] ?? 'takeout');
  const [partySize, setPartySize] = useState(2);

  const chosen = useMemo(() => buildChoice({
    draft,
    catalog,
    channel,
    prepHandoff,
    prepWindow,
    prepAddress,
    pickupSlot,
    organization,
    dropoffWindow,
    caterAddress,
    service: draft.area === 'ghost_kitchen' ? 'takeout' : service,
    partySize,
  }), [
    draft,
    catalog,
    channel,
    prepHandoff,
    prepWindow,
    prepAddress,
    pickupSlot,
    organization,
    dropoffWindow,
    caterAddress,
    service,
    partySize,
  ]);

  const delivery = fulfillmentIsDeliverySafe(chosen.handoff);
  const quote = useDeliveryQuote(draft.sellerId, delivery);

  useEffect(() => {
    onChange({
      key,
      handoff: chosen.handoff,
      block: chosen.block,
      deliveryFee: delivery && !quote.loading ? quote.deliveryFee : 0,
      deliveryLoading: delivery && quote.loading,
    });
  }, [chosen.block, chosen.handoff, delivery, key, onChange, quote.deliveryFee, quote.loading]);

  return (
    <View style={styles.wrap} testID={`combined-handoff-${draft.area}`}>
      <Text style={styles.section}>How this order is handed off</Text>
      {draft.area === 'farm' ? FARM_CHANNELS.map((option) => (
        <GlassPressable key={option} style={[styles.option, channel === option && styles.optionOn]} onPress={() => setChannel(option)}>
          <Text style={[styles.optionText, channel === option && styles.optionTextOn]}>{channelLabel(option)}</Text>
        </GlassPressable>
      )) : null}
      {draft.area === 'meal_prep' ? (
        <View>
          {(['pickup', 'dropoff'] as const).map((option) => (
            <GlassPressable key={option} style={[styles.option, prepHandoff === option && styles.optionOn]} onPress={() => setPrepHandoff(option)}>
              <Text style={[styles.optionText, prepHandoff === option && styles.optionTextOn]}>{option === 'pickup' ? 'Pickup' : 'Drop-off'}</Text>
            </GlassPressable>
          ))}
          {(catalog.windows.length > 0 ? catalog.windows : [{ label: 'Cook confirms the handoff' }]).map((option) => (
            <GlassPressable key={option.label} style={[styles.option, (prepWindow || catalog.windows[0]?.label || 'Cook confirms the handoff') === option.label && styles.optionOn]} onPress={() => setPrepWindow(option.label)}>
              <Text style={styles.optionText}>{option.label}</Text>
            </GlassPressable>
          ))}
          {prepHandoff === 'dropoff' ? (
            <TextInput
              value={prepAddress}
              onChangeText={setPrepAddress}
              placeholder="Household address"
              placeholderTextColor={Colors.gray[400]}
              style={styles.input}
            />
          ) : null}
        </View>
      ) : null}
      {draft.area === 'food_truck' || draft.area === 'food_cart' ? PICKUP_SLOTS.map((option) => (
        <GlassPressable key={option} style={[styles.option, pickupSlot === option && styles.optionOn]} onPress={() => setPickupSlot(option)}>
          <Text style={[styles.optionText, pickupSlot === option && styles.optionTextOn]}>{option}</Text>
        </GlassPressable>
      )) : null}
      {draft.area === 'catering' ? (
        <View>
          <TextInput
            value={organization}
            onChangeText={setOrganization}
            placeholder="Organization"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
          />
          {DROP_OFF_WINDOWS.map((option) => (
            <GlassPressable key={option} style={[styles.option, dropoffWindow === option && styles.optionOn]} onPress={() => setDropoffWindow(option)}>
              <Text style={[styles.optionText, dropoffWindow === option && styles.optionTextOn]}>{option}</Text>
            </GlassPressable>
          ))}
          <TextInput
            value={caterAddress}
            onChangeText={setCaterAddress}
            placeholder="Drop-off address"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
          />
        </View>
      ) : null}
      {draft.area === 'ghost_kitchen' ? (
        <Text style={styles.optionText}>Takeout. A ghost kitchen has no table.</Text>
      ) : null}
      {draft.area === 'sit_down' ? (
        <View>
          {catalog.services.map((option) => (
            <GlassPressable key={option} style={[styles.option, service === option && styles.optionOn]} onPress={() => setService(option)}>
              <Text style={[styles.optionText, service === option && styles.optionTextOn]}>{SERVICE_LABEL[option]}</Text>
            </GlassPressable>
          ))}
          {service === 'sit_down' ? (
            <View style={styles.chips}>
              {PARTY.map((size) => (
                <GlassPressable key={size} style={[styles.chip, partySize === size && styles.optionOn]} onPress={() => setPartySize(size)}>
                  <Text style={[styles.optionText, partySize === size && styles.optionTextOn]}>{size}</Text>
                </GlassPressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {chosen.block ? <Text style={styles.block}>{chosen.block}</Text> : null}
      {chosen.warning ? <Text style={styles.warning}>{chosen.warning}</Text> : null}
      <DeliveryLevyLines deliveryFee={quote.deliveryFee} active={delivery && !quote.loading} />
    </View>
  );
}

function fulfillmentIsDeliverySafe(handoff: ShopFulfillment | null): boolean {
  return handoff ? fulfillmentIsDelivery(handoff) : false;
}

type Catalog = {
  farmName: string;
  tracks: RegulatoryTrack[];
  cookId: string;
  cookName: string;
  windows: { label: string }[];
  readyCount: number;
  cookCount: number;
  truckId: string;
  truckName: string;
  companyId: string;
  companyName: string;
  placeId: string;
  placeName: string;
  services: DiningService[];
};

function resolveCatalog(draft: CombinedCheckoutDraft): Catalog {
  const empty: Catalog = {
    farmName: draft.sellerName,
    tracks: [],
    cookId: '',
    cookName: draft.sellerName,
    windows: [],
    readyCount: 0,
    cookCount: 0,
    truckId: '',
    truckName: draft.sellerName,
    companyId: '',
    companyName: draft.sellerName,
    placeId: '',
    placeName: draft.sellerName,
    services: ['takeout'],
  };
  if (draft.area === 'farm') {
    const tracks = draft.lines.flatMap((line) => {
      const product = getCatalogProduct(line.productId);
      return product ? [product.track] : [];
    });
    const product = getCatalogProduct(draft.lines[0]?.productId ?? '');
    const farm = product ? getFarm(product.farmId) : undefined;
    return { ...empty, farmName: farm?.name || draft.sellerName, tracks };
  }
  if (draft.area === 'meal_prep') {
    const first = getPrepItem(draft.lines[0]?.productId ?? '');
    const cook = first ? getPrepCook(first.cookId) : undefined;
    let readyCount = 0;
    let cookCount = 0;
    for (const line of draft.lines) {
      const item = getPrepItem(line.productId);
      if (item?.lane === 'cook') cookCount += line.quantity;
      else readyCount += line.quantity;
    }
    return {
      ...empty,
      cookId: cook?.id || first?.cookId || '',
      cookName: cook?.name || draft.sellerName,
      windows: (cook?.windows ?? []).map((item) => ({ label: windowLabel(item.day, item.hours, item.place) })),
      readyCount,
      cookCount,
    };
  }
  if (draft.area === 'food_truck' || draft.area === 'food_cart') {
    const first = getMenuItem(draft.lines[0]?.productId ?? '');
    const truck = first ? getTruck(first.truckId) : undefined;
    return { ...empty, truckId: truck?.id || first?.truckId || '', truckName: truck?.name || draft.sellerName };
  }
  if (draft.area === 'catering') {
    const first = getPackage(draft.lines[0]?.productId ?? '');
    const company = first ? getCompany(first.companyId) : undefined;
    return { ...empty, companyId: company?.id || first?.companyId || '', companyName: company?.name || draft.sellerName };
  }
  const first = getSitItem(draft.lines[0]?.productId ?? '');
  const place = first ? getPlace(first.placeId) : undefined;
  const services = place?.services?.length ? place.services : ['takeout' as const];
  return {
    ...empty,
    placeId: place?.id || first?.placeId || '',
    placeName: place?.name || draft.sellerName,
    services: draft.area === 'ghost_kitchen' ? ['takeout'] : services,
  };
}

function buildChoice(input: {
  draft: CombinedCheckoutDraft;
  catalog: Catalog;
  channel: FarmChannel;
  prepHandoff: 'pickup' | 'dropoff';
  prepWindow: string;
  prepAddress: string;
  pickupSlot: (typeof PICKUP_SLOTS)[number];
  organization: string;
  dropoffWindow: (typeof DROP_OFF_WINDOWS)[number];
  caterAddress: string;
  service: DiningService;
  partySize: number;
}): { handoff: ShopFulfillment | null; block: string | null; warning: string | null } {
  const { draft, catalog } = input;
  if (draft.area === 'farm') {
    const block = catalog.tracks.map((track) => buyerChannelBlock(track, input.channel)).find((reason) => reason) ?? null;
    const warning = catalog.tracks.map((track) => channelWarning(track, input.channel)).find((reason) => reason) ?? null;
    const parsed = shopFulfillmentSchema.safeParse({ shop: 'farm', channel: input.channel });
    return { handoff: block || !parsed.success ? null : parsed.data, block, warning };
  }
  if (draft.area === 'meal_prep') {
    const chosenWindow = input.prepWindow || catalog.windows[0]?.label || 'Cook confirms the handoff';
    const parsed = shopFulfillmentSchema.safeParse({
      shop: 'meal_prep',
      cookId: catalog.cookId || draft.sellerId || 'cook',
      cookName: catalog.cookName,
      handoff: input.prepHandoff,
      windowLabel: chosenWindow,
      address: input.prepAddress.trim(),
      mix: weekMix(catalog.readyCount, catalog.cookCount),
    });
    return {
      handoff: parsed.success ? parsed.data : null,
      block: parsed.success ? null : 'Enter the household address for drop-off.',
      warning: null,
    };
  }
  if (draft.area === 'food_truck' || draft.area === 'food_cart') {
    const parsed = shopFulfillmentSchema.safeParse({
      shop: 'food_truck',
      truckId: catalog.truckId || draft.sellerId || 'truck',
      truckName: catalog.truckName,
      pickupSlot: input.pickupSlot,
    });
    return { handoff: parsed.success ? parsed.data : null, block: parsed.success ? null : 'Choose a pickup time.', warning: null };
  }
  if (draft.area === 'catering') {
    const parsed = shopFulfillmentSchema.safeParse({
      shop: 'catering',
      companyId: catalog.companyId || draft.sellerId || 'company',
      companyName: catalog.companyName,
      organization: input.organization.trim(),
      dropoffWindow: input.dropoffWindow,
      address: input.caterAddress.trim(),
    });
    return {
      handoff: parsed.success ? parsed.data : null,
      block: parsed.success ? null : 'Enter the organization and the drop-off address.',
      warning: null,
    };
  }
  if (draft.area === 'sit_down' || draft.area === 'ghost_kitchen') {
    const chosen = draft.area === 'ghost_kitchen' ? 'takeout' : input.service;
    const parsed = shopFulfillmentSchema.safeParse({
      shop: 'sit_down',
      placeId: catalog.placeId || draft.sellerId || 'place',
      placeName: catalog.placeName,
      service: chosen,
      partySize: chosen === 'takeout' ? 1 : input.partySize,
    });
    return { handoff: parsed.success ? parsed.data : null, block: parsed.success ? null : 'Choose how you eat.', warning: null };
  }
  return { handoff: null, block: null, warning: null };
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  section: { color: Colors.gray[800], fontWeight: '700', marginBottom: 6 },
  option: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6, backgroundColor: Colors.gray[100] },
  optionOn: { backgroundColor: Colors.gray[900] },
  optionText: { color: Colors.gray[800] },
  optionTextOn: { color: Colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.gray[100] },
  input: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10, padding: 10, marginBottom: 6, color: Colors.gray[900] },
  block: { color: '#9A3412', marginTop: 4, lineHeight: 20 },
  warning: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
});
