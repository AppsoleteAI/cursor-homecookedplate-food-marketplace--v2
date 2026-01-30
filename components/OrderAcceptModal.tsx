import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface OrderAcceptModalProps {
  visible: boolean;
  orderId: string;
  mealName: string;
  onClose: () => void;
  onSuccess: () => void;
  acceptOrder: (orderId: string, estimatedCompletionTime?: string) => Promise<void>;
}

/**
 * Order Accept Modal
 * 
 * Allows platemakers to accept orders with an optional estimated completion time (ETA).
 * ETA is optional - orders can be accepted without providing a completion time.
 */
export const OrderAcceptModal: React.FC<OrderAcceptModalProps> = ({
  visible,
  orderId,
  mealName,
  onClose,
  onSuccess,
  acceptOrder,
}) => {
  const [etaText, setEtaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      let estimatedCompletionTime: string | undefined;
      
      // If ETA text is provided, validate and parse it
      if (etaText.trim()) {
        const etaDate = new Date(etaText.trim());
        if (isNaN(etaDate.getTime())) {
          Alert.alert('Invalid Date', 'Please enter a valid date and time (e.g., 2025-01-15T18:00:00)');
          setIsSubmitting(false);
          return;
        }
        if (etaDate <= new Date()) {
          Alert.alert('Invalid Date', 'Estimated completion time must be in the future');
          setIsSubmitting(false);
          return;
        }
        estimatedCompletionTime = etaDate.toISOString();
      }

      await acceptOrder(orderId, estimatedCompletionTime);
      onSuccess();
      onClose();
      // Reset state
      setEtaText('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to accept order');
    } finally {
      setIsSubmitting(false);
    }
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
            <Text style={styles.title}>Accept Order</Text>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.mealName}>{mealName}</Text>
          <Text style={styles.subtitle}>
            You can optionally provide an estimated completion time for this order.
          </Text>

          <View style={styles.etaSection}>
            <Text style={styles.etaLabel}>Estimated Completion Time (Optional)</Text>
            <Text style={styles.etaHint}>
              Enter date and time in ISO format (e.g., 2025-01-15T18:00:00) or leave blank
            </Text>
            <TextInput
              style={styles.etaInput}
              value={etaText}
              onChangeText={setEtaText}
              placeholder="2025-01-15T18:00:00"
              placeholderTextColor={Colors.gray[400]}
              editable={!isSubmitting}
            />
            {etaText && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setEtaText('')}
                disabled={isSubmitting}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.acceptButtonText}>Accept Order</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 24,
  },
  etaSection: {
    marginBottom: 24,
  },
  etaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 8,
  },
  etaInput: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.gray[900],
  },
  etaHint: {
    fontSize: 11,
    color: Colors.gray[500],
    marginBottom: 8,
    fontStyle: 'italic',
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    fontSize: 12,
    color: Colors.gradient.green,
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
  acceptButton: {
    backgroundColor: Colors.gradient.green,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
