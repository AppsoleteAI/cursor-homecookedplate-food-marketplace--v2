import { COMBINED_HANDOFF, isCombinedShopFulfillment, type SavedShopOrder } from '@/backend/lib/shop-fulfillment';
import { getPackage } from '@/constants/cater-event-deliver';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem } from '@/constants/food-truck-popup';
import { getPrepItem } from '@/constants/meal-prep-go';
import { getSitItem } from '@/constants/sit-down-delicious';
import type { CaterOrder } from '@/hooks/cater-event-store';
import type { FarmOrder } from '@/hooks/farm-basket-store';
import type { TruckOrder } from '@/hooks/food-truck-store';
import type { PrepOrder } from '@/hooks/meal-prep-store';
import type { SitOrder } from '@/hooks/sit-down-store';

export function mergeById<T extends { id: string; createdAt: string }>(current: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((order) => order.id));
  const localOnly = current.filter((order) => !incomingIds.has(order.id));
  return [...localOnly, ...incoming].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function sameOrders<T extends { id: string; createdAt: string }>(left: T[], right: T[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function farmOrdersFromSaved(rows: SavedShopOrder[]): FarmOrder[] {
  return rows.flatMap((row) => {
    if (isCombinedShopFulfillment(row.fulfillment)) {
      if (row.shop !== 'farm') return [];
      return [{
        id: row.id,
        createdAt: row.createdAt,
        channel: 'farm_pickup' as const,
        handoffNote: COMBINED_HANDOFF,
        lines: row.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          track: getCatalogProduct(item.productId)?.track ?? 'whole_produce' as const,
        })),
        baseAmount: row.baseAmount,
        buyerPays: row.buyerPays,
        sellerPayout: row.sellerPayout,
        paid: row.paid,
        sellerId: row.sellerId,
        orderStatus: row.orderStatus,
      }];
    }
    if (row.fulfillment.shop !== 'farm') return [];
    const order: FarmOrder = {
      id: row.id,
      createdAt: row.createdAt,
      channel: row.fulfillment.channel,
      lines: row.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        track: getCatalogProduct(item.productId)?.track ?? 'whole_produce',
      })),
      baseAmount: row.baseAmount,
      buyerPays: row.buyerPays,
      sellerPayout: row.sellerPayout,
      paid: row.paid,
      sellerId: row.sellerId,
      orderStatus: row.orderStatus,
    };
    return [order];
  });
}

export function prepOrdersFromSaved(rows: SavedShopOrder[]): PrepOrder[] {
  return rows.flatMap((row) => {
    if (isCombinedShopFulfillment(row.fulfillment)) {
      if (row.shop !== 'meal_prep') return [];
      return [{
        id: row.id,
        createdAt: row.createdAt,
        cookId: row.fulfillment.sellerId,
        cookName: row.fulfillment.sellerName,
        handoff: 'pickup' as const,
        windowLabel: COMBINED_HANDOFF,
        address: '',
        mix: COMBINED_HANDOFF,
        handoffNote: COMBINED_HANDOFF,
        lines: row.items.map((item) => {
          const catalog = getPrepItem(item.productId);
          return {
            itemId: item.productId,
            name: item.name,
            lane: catalog?.lane ?? 'ready' as const,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            minutes: catalog?.minutes ?? 0,
          };
        }),
        baseAmount: row.baseAmount,
        buyerPays: row.buyerPays,
        sellerPayout: row.sellerPayout,
        paid: row.paid,
        sellerId: row.sellerId,
        orderStatus: row.orderStatus,
      }];
    }
    if (row.fulfillment.shop !== 'meal_prep') return [];
    const order: PrepOrder = {
      id: row.id,
      createdAt: row.createdAt,
      cookId: row.fulfillment.cookId,
      cookName: row.fulfillment.cookName,
      handoff: row.fulfillment.handoff,
      windowLabel: row.fulfillment.windowLabel,
      address: row.fulfillment.address,
      mix: row.fulfillment.mix,
      lines: row.items.map((item) => {
        const catalog = getPrepItem(item.productId);
        return {
          itemId: item.productId,
          name: item.name,
          lane: catalog?.lane ?? 'ready',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          minutes: catalog?.minutes ?? 0,
        };
      }),
      baseAmount: row.baseAmount,
      buyerPays: row.buyerPays,
      sellerPayout: row.sellerPayout,
      paid: row.paid,
      sellerId: row.sellerId,
      orderStatus: row.orderStatus,
    };
    return [order];
  });
}

export function truckOrdersFromSaved(rows: SavedShopOrder[]): TruckOrder[] {
  return rows.flatMap((row) => {
    if (isCombinedShopFulfillment(row.fulfillment)) {
      if (row.shop !== 'food_truck') return [];
      return [{
        id: row.id,
        createdAt: row.createdAt,
        truckId: row.fulfillment.sellerId,
        truckName: row.fulfillment.sellerName,
        pickupSlot: 'Next 15 minutes',
        handoffNote: COMBINED_HANDOFF,
        lines: row.items.map((item) => ({
          itemId: item.productId,
          name: getMenuItem(item.productId)?.name ?? item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        baseAmount: row.baseAmount,
        buyerPays: row.buyerPays,
        sellerPayout: row.sellerPayout,
        paid: row.paid,
        sellerId: row.sellerId,
        orderStatus: row.orderStatus,
      }];
    }
    if (row.fulfillment.shop !== 'food_truck') return [];
    const order: TruckOrder = {
      id: row.id,
      createdAt: row.createdAt,
      truckId: row.fulfillment.truckId,
      truckName: row.fulfillment.truckName,
      pickupSlot: row.fulfillment.pickupSlot,
      lines: row.items.map((item) => ({
        itemId: item.productId,
        name: getMenuItem(item.productId)?.name ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      baseAmount: row.baseAmount,
      buyerPays: row.buyerPays,
      sellerPayout: row.sellerPayout,
      paid: row.paid,
      sellerId: row.sellerId,
      orderStatus: row.orderStatus,
    };
    return [order];
  });
}

export function caterOrdersFromSaved(rows: SavedShopOrder[]): CaterOrder[] {
  return rows.flatMap((row) => {
    if (isCombinedShopFulfillment(row.fulfillment)) {
      if (row.shop !== 'catering') return [];
      return [{
        id: row.id,
        createdAt: row.createdAt,
        companyId: row.fulfillment.sellerId,
        companyName: row.fulfillment.sellerName,
        organization: row.fulfillment.sellerName,
        dropoffWindow: 'Weekday lunch, 11:00–1:00' as const,
        address: '',
        handoffNote: COMBINED_HANDOFF,
        lines: row.items.map((item) => ({
          packageId: item.productId,
          name: getPackage(item.productId)?.name ?? item.name,
          headcount: item.quantity,
          pricePerPerson: item.unitPrice,
        })),
        baseAmount: row.baseAmount,
        buyerPays: row.buyerPays,
        sellerPayout: row.sellerPayout,
        paid: row.paid,
        sellerId: row.sellerId,
        orderStatus: row.orderStatus,
      }];
    }
    if (row.fulfillment.shop !== 'catering') return [];
    const order: CaterOrder = {
      id: row.id,
      createdAt: row.createdAt,
      companyId: row.fulfillment.companyId,
      companyName: row.fulfillment.companyName,
      organization: row.fulfillment.organization,
      dropoffWindow: row.fulfillment.dropoffWindow,
      address: row.fulfillment.address,
      lines: row.items.map((item) => ({
        packageId: item.productId,
        name: getPackage(item.productId)?.name ?? item.name,
        headcount: item.quantity,
        pricePerPerson: item.unitPrice,
      })),
      baseAmount: row.baseAmount,
      buyerPays: row.buyerPays,
      sellerPayout: row.sellerPayout,
      paid: row.paid,
      sellerId: row.sellerId,
      orderStatus: row.orderStatus,
    };
    return [order];
  });
}

export function sitOrdersFromSaved(rows: SavedShopOrder[]): SitOrder[] {
  return rows.flatMap((row) => {
    if (isCombinedShopFulfillment(row.fulfillment)) {
      if (row.shop !== 'sit_down') return [];
      return [{
        id: row.id,
        createdAt: row.createdAt,
        placeId: row.fulfillment.sellerId,
        placeName: row.fulfillment.sellerName,
        service: 'takeout' as const,
        partySize: 1,
        handoffNote: COMBINED_HANDOFF,
        lines: row.items.map((item) => ({
          itemId: item.productId,
          name: getSitItem(item.productId)?.name ?? item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        baseAmount: row.baseAmount,
        buyerPays: row.buyerPays,
        sellerPayout: row.sellerPayout,
        paid: row.paid,
        sellerId: row.sellerId,
        orderStatus: row.orderStatus,
      }];
    }
    if (row.fulfillment.shop !== 'sit_down') return [];
    const order: SitOrder = {
      id: row.id,
      createdAt: row.createdAt,
      placeId: row.fulfillment.placeId,
      placeName: row.fulfillment.placeName,
      service: row.fulfillment.service,
      partySize: row.fulfillment.partySize,
      lines: row.items.map((item) => ({
        itemId: item.productId,
        name: getSitItem(item.productId)?.name ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      baseAmount: row.baseAmount,
      buyerPays: row.buyerPays,
      sellerPayout: row.sellerPayout,
      paid: row.paid,
      sellerId: row.sellerId,
      orderStatus: row.orderStatus,
    };
    return [order];
  });
}
