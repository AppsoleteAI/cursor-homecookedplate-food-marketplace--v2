import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface OrderRefundModalProps {
  visible: boolean;
  orderId: string;
  mealName: string;
  totalPrice: number;
  refundAmount: number;
  platformFeeKept: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
}

/**
 * Order Refund Modal
 * 
 * Confirmation modal for platemakers to refund orders at their 90% share.
 * Displays refund amount, platform fee notice, and warning about refund being final.
 */
export const OrderRefundModal: React.FC<OrderRefundModalProps> = ({
  visible,
  orderId,
  mealName,
  totalPrice,
  refundAmount,
  platformFeeKept,
  onClose,
  onConfirm,
  isProcessing,
}) => {
  const handleConfirm = async () => {
    Alert.alert(
      'Confirm Refund',
      'This action cannot be undone. The buyer will receive a refund of your 90% share. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              await onConfirm();
              onClose();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process refund');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Refund Order</Text>
            <TouchableOpacity onPress={onClose} disabled={isProcessing}>
              <Ionicons name="close" size={24} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.mealName}>{mealName}</Text>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Total:</Text>
              <Text style={styles.infoValue}>${totalPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Refund Amount (90%):</Text>
              <Text style={[styles.infoValue, styles.refundAmount]}>
                ${refundAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform Fee Kept:</Text>
              <Text style={styles.infoValue}>${platformFeeKept.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.noticeBox}>
            <Ionicons name="information-circle" size={20} color={Colors.gradient.orange} />
            <Text style={styles.noticeText}>
              HomeCookedPlate does not refund platform fees. You will receive 90% of the base order amount.
            </Text>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.warningText}>
              This refund is final and cannot be undone. The buyer will receive the refund amount shown above.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.refundButton, isProcessing && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.refundButtonText}>Process Refund</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[800],
    marginBottom: 24,
  },
  infoSection: {
    backgroundColor: Colors.gray[50],
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  refundAmount: {
    color: Colors.gradient.green,
    fontSize: 16,
    fontWeight: '700',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: Colors.blue[50],
    borderWidth: 1,
    borderColor: Colors.blue[200],
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: Colors.blue[800],
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.warning + '10',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray[800],
    lineHeight: 18,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.gray[100],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  refundButton: {
    backgroundColor: Colors.gradient.green,
  },
  refundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
