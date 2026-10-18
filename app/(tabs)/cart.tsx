import React from 'react';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { BuyerOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router , type Href } from 'expo-router';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { FoodHandlingNotice } from '@/components/FoodHandlingNotice';
import { CHECKOUT_AREA_LABEL } from '@/backend/lib/combined-checkout';
import { useCart } from '@/hooks/cart-context';
import { useCombinedBill } from '@/hooks/use-combined-bill';
import { calculateOrderSplit } from '@/lib/fees';

export default function CartScreen() {
  const { items, totalPrice, updateQuantity, removeFromCart } = useCart();
  const { payInMainCart, preview, gathered } = useCombinedBill();
  const insets = useSafeAreaInsets();

  const split = calculateOrderSplit(totalPrice);
  const serviceFee = split.totalCaptured - totalPrice;
  const finalTotal = split.totalCaptured;

  if (items.length === 0 && !payInMainCart) {
    return (
      <BuyerOnly>
        <SafeAreaView style={styles.container}>
          <View style={styles.emptyContainer}>
            <FoodHandlingNotice inset testID="cart-food-handling" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>Add some delicious meals to get started!</Text>
            <GlassPressable onPress={() => router.push('/farm-grown-basket' as Href)} testID="empty-cart-farm">
              <Text style={styles.farmLinkDark}>Looking for farm goods? Open FarmGrownBasket.</Text>
            </GlassPressable>
            <GlassPressable onPress={() => router.push('/food-truck-popup' as Href)} testID="empty-cart-truck">
              <Text style={styles.farmLinkDark}>Looking for a food truck? Open FoodTruckPopup.</Text>
            </GlassPressable>
            <GlassPressable onPress={() => router.push('/cater-event-deliver' as Href)} testID="empty-cart-cater">
              <Text style={styles.farmLinkDark}>Ordering for a group? Open CaterEventDeliver.</Text>
            </GlassPressable>
            <GlassPressable onPress={() => router.push('/sit-down-delicious' as Href)} testID="empty-cart-sit">
              <Text style={styles.farmLinkDark}>Looking for a local restaurant? Open SitDownDelicious.</Text>
            </GlassPressable>
            <GradientButton
              title="Browse Meals"
              onPress={() => router.push('/(tabs)/(home)/home')}
              style={styles.browseButton}
            />
          </View>
        </SafeAreaView>
      </BuyerOnly>
    );
  }

  return (
    <BuyerOnly>
      <SafeAreaView style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.green}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerCard, { paddingTop: insets.top }]}
          >
            <View style={styles.headerInner}>
              <Text style={styles.headerTitle}>Your Cart</Text>
              <GlassPressable onPress={() => router.push('/farm-grown-basket/basket' as Href)} testID="cart-farm-basket">
                <Text style={styles.farmLink}>Farm goods use FarmGrownBasket</Text>
              </GlassPressable>
              <GlassPressable onPress={() => router.push('/food-truck-popup/basket' as Href)} testID="cart-truck-basket">
                <Text style={styles.farmLink}>Food trucks use FoodTruckPopup</Text>
              </GlassPressable>
              <GlassPressable onPress={() => router.push('/cater-event-deliver/basket' as Href)} testID="cart-cater-basket">
                <Text style={styles.farmLink}>Group catering uses CaterEventDeliver</Text>
              </GlassPressable>
              <GlassPressable onPress={() => router.push('/sit-down-delicious/basket' as Href)} testID="cart-sit-basket">
                <Text style={styles.farmLink}>Restaurants use SitDownDelicious</Text>
              </GlassPressable>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentWithHeader}
        >
        <FoodHandlingNotice testID="cart-food-handling" />
        {items.map(item => (
          <View key={item.meal.id} style={styles.cartItem}>
            <Image source={{ uri: item.meal.images[0] }} style={styles.itemImage} />
            <View style={styles.itemRight}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.meal.name}</Text>
                <Text style={styles.plateMaker}>{item.meal.plateMakerName}</Text>
                <Text style={styles.itemPrice}>${item.meal.price.toFixed(2)}</Text>
              </View>
              <View style={styles.actionsRow} testID="cart-item-actions">
                <View style={styles.quantityContainer}>
                  <GlassPressable
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.meal.id, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={16} color={Colors.gray[600]} />
                  </GlassPressable>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <GlassPressable
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.meal.id, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color={Colors.gray[600]} />
                  </GlassPressable>
                </View>
                <GlassPressable
                  style={styles.removeButton}
                  onPress={() => removeFromCart(item.meal.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.gradient.red} />
                </GlassPressable>
              </View>
            </View>
          </View>
        ))}

        {payInMainCart ? (
          <View style={styles.summaryContainer} testID="combined-bill">
            <Text style={styles.summaryTitle}>One bill</Text>
            <Text style={styles.summaryNote}>Each section keeps its own service fee. One card pays all of them.</Text>
            {preview.checkouts.map((checkout) => (
              <View key={checkout.id} style={styles.sectionBill}>
                <Text style={styles.itemName}>{CHECKOUT_AREA_LABEL[checkout.area]} · {checkout.sellerName}</Text>
                {checkout.lines.map((line) => (
                  <Text key={`${checkout.id}-${line.name}`} style={styles.summaryNote}>{line.quantity} × {line.name} · ${line.unitPrice.toFixed(2)}</Text>
                ))}
                <Text style={styles.summaryNote}>Section ${checkout.baseAmount.toFixed(2)} · Service fee ${checkout.buyerFee.toFixed(2)} · You pay ${checkout.buyerPays.toFixed(2)}</Text>
              </View>
            ))}
            {gathered.blocked.map((reason) => (
              <Text key={reason} style={styles.blocked}>{reason}</Text>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${preview.combinedBuyerPays.toFixed(2)}</Text>
            </View>
          </View>
        ) : null}

        {!payInMainCart ? <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service fee (10%)</Text>
            <Text style={styles.summaryValue}>${serviceFee.toFixed(2)}</Text>
          </View>

          <Text style={styles.summaryNote}>Pickup has no delivery fee. For delivery, the cook sets the fee and you pay that fee plus 5%.</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
          </View>
        </View> : null}
      </ScrollView>

        <View style={styles.footer}>
          <View style={styles.warningBox} testID="checkout-warning">
            <ScrollView style={styles.warningScroll} showsVerticalScrollIndicator>
              <Text style={styles.warningText}>⚠️ You waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any items you purchase as a PlateTaker and you affirm all local, county, state and federal food service laws are actively being adhered to, in every transaction via the HomeCookedPlate app.</Text>
            </ScrollView>
          </View>
          {payInMainCart ? (
            <GradientButton
              title={`Pay this bill • ${preview.combinedBuyerPays.toFixed(2)}`}
              onPress={() => router.push('/combined-checkout' as Href)}
              baseColor="green"
              testID="pay-together"
            />
          ) : (
            <GradientButton
              title={`Checkout • ${finalTotal.toFixed(2)}`}
              onPress={() => {
                try {
                  router.push('/checkout');
                } catch (error) {
                  console.error('[cart] Error navigating to checkout:', error);
                }
              }}
              baseColor="green"
              testID="go-to-checkout"
            />
          )}
        </View>
      </SafeAreaView>
    </BuyerOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pagePastel.green,
  },
  staticHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerCard: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  headerInner: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  farmLink: {
    color: Colors.white,
    marginTop: 6,
    fontWeight: '600',
  },
  farmLinkDark: {
    color: '#166534',
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContentWithHeader: {
    paddingTop: 120,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 28,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    ...glassSurface,
  },
  itemRight: {
    flex: 1,
    paddingLeft: 12,
  },
  itemDetails: {
    flex: 0,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  plateMaker: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gradient.orange,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 0,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  removeButton: {
    padding: 8,
    marginLeft: 12,
  },
  summaryContainer: {
    marginTop: 24,
    marginHorizontal: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  summaryNote: {
    fontSize: 13,
    color: Colors.gray[500],
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray[200],
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gradient.green,
  },
  sectionBill: { marginBottom: 12 },
  blocked: { color: '#9A3412', lineHeight: 20, marginBottom: 8 },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    backgroundColor: Colors.white,
    marginTop: 20,
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: 9,
    borderRadius: 8,
    marginBottom: 9,
  },
  warningScroll: {
    height: 48,
  },
  warningText: { fontSize: 12, color: Colors.warning, lineHeight: 16 },
});