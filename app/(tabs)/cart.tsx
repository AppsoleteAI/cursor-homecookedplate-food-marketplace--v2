import React from 'react';
import { BuyerOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { useCart } from '@/hooks/cart-context';

export default function CartScreen() {
  const { items, totalPrice, updateQuantity, removeFromCart } = useCart();
  const insets = useSafeAreaInsets();

  const serviceFee = totalPrice * 0.15;
  const stripeFee = totalPrice * 0.029 + 0.30;
  const deliveryFee = 5.99;
  const finalTotal = totalPrice + serviceFee + stripeFee + deliveryFee;

  if (items.length === 0) {
    return (
      <BuyerOnly>
        <SafeAreaView style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>Add some delicious meals to get started!</Text>
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
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentWithHeader}
        >
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
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.meal.id, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={16} color={Colors.gray[600]} />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.meal.id, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color={Colors.gray[600]} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromCart(item.meal.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.gradient.red} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Fee (15%)</Text>
            <Text style={styles.summaryValue}>${serviceFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Processing Fee</Text>
            <Text style={styles.summaryValue}>${stripeFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

        <View style={styles.footer}>
          <View style={styles.warningBox} testID="checkout-warning">
            <ScrollView style={styles.warningScroll} showsVerticalScrollIndicator>
              <Text style={styles.warningText}>⚠️ You waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any items you purchase as a PlateTaker and you affirm all local, county, state and federal food service laws are actively being adhered to, in every transaction via the HomeCookedPlate app.</Text>
            </ScrollView>
          </View>
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
        </View>
      </SafeAreaView>
    </BuyerOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerInner: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
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
    paddingHorizontal: 32,
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