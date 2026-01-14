import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Tag, Calendar, Percent, Gift, X, Trash2 } from 'lucide-react-native';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { PromotionalOffer } from '@/types';
import { useAuth } from '@/hooks/auth-context';
import { useNotifications } from '@/hooks/notifications-context';

export default function PromotionsScreen() {
  const { user } = useAuth();
  const { sendPromotionNotification } = useNotifications();
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PromotionalOffer | null>(null);

  const [formData, setFormData] = useState({
    type: 'percentage' as PromotionalOffer['type'],
    title: '',
    description: '',
    discountPercentage: '',
    discountAmount: '',
    buyQuantity: '',
    getQuantity: '',
    freeItemName: '',
    startDate: '',
    endDate: '',
  });

  const resetForm = useCallback(() => {
    setFormData({
      type: 'percentage',
      title: '',
      description: '',
      discountPercentage: '',
      discountAmount: '',
      buyQuantity: '',
      getQuantity: '',
      freeItemName: '',
      startDate: '',
      endDate: '',
    });
    setEditingOffer(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((offer: PromotionalOffer) => {
    setEditingOffer(offer);
    setFormData({
      type: offer.type,
      title: offer.title,
      description: offer.description,
      discountPercentage: offer.discountPercentage?.toString() || '',
      discountAmount: offer.discountAmount?.toString() || '',
      buyQuantity: offer.buyQuantity?.toString() || '',
      getQuantity: offer.getQuantity?.toString() || '',
      freeItemName: offer.freeItemName || '',
      startDate: offer.startDate.toISOString().split('T')[0],
      endDate: offer.endDate.toISOString().split('T')[0],
    });
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    resetForm();
  }, [resetForm]);

  const validateForm = useMemo(() => {
    if (!formData.title.trim() || !formData.description.trim()) return false;
    if (!formData.startDate || !formData.endDate) return false;

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    if (start > end) return false;

    switch (formData.type) {
      case 'percentage': {
        const pct = Number(formData.discountPercentage);
        return pct > 0 && pct <= 100;
      }
      case 'fixed-amount':
        return Number(formData.discountAmount) > 0;
      case 'buy-x-get-y':
        return Number(formData.buyQuantity) > 0 && Number(formData.getQuantity) > 0;
      case 'free-item':
        return formData.freeItemName.trim().length > 0;
      default:
        return false;
    }
  }, [formData]);

  const saveOffer = useCallback(async () => {
    if (!validateForm) {
      Alert.alert('Invalid Form', 'Please fill in all required fields correctly.');
      return;
    }

    const newOffer: PromotionalOffer = {
      id: editingOffer?.id || Date.now().toString(),
      type: formData.type,
      title: formData.title,
      description: formData.description,
      discountPercentage: formData.type === 'percentage' ? Number(formData.discountPercentage) : undefined,
      discountAmount: formData.type === 'fixed-amount' ? Number(formData.discountAmount) : undefined,
      buyQuantity: formData.type === 'buy-x-get-y' ? Number(formData.buyQuantity) : undefined,
      getQuantity: formData.type === 'buy-x-get-y' ? Number(formData.getQuantity) : undefined,
      freeItemName: formData.type === 'free-item' ? formData.freeItemName : undefined,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      isActive: true,
      createdAt: editingOffer?.createdAt || new Date(),
    };

    if (editingOffer) {
      setOffers(prev => prev.map(o => o.id === editingOffer.id ? newOffer : o));
      Alert.alert('Success', 'Promotion updated successfully!');
    } else {
      setOffers(prev => [...prev, newOffer]);
      await sendPromotionNotification(newOffer.title, newOffer.description);
      Alert.alert('Success', 'Promotion created and customers notified!');
    }

    closeModal();
  }, [formData, validateForm, editingOffer, closeModal, sendPromotionNotification]);

  const deleteOffer = useCallback((offerId: string) => {
    Alert.alert(
      'Delete Promotion',
      'Are you sure you want to delete this promotion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setOffers(prev => prev.filter(o => o.id !== offerId));
          },
        },
      ]
    );
  }, []);

  const toggleOfferStatus = useCallback((offerId: string) => {
    setOffers(prev => prev.map(o => 
      o.id === offerId ? { ...o, isActive: !o.isActive } : o
    ));
  }, []);

  const getOfferIcon = (type: PromotionalOffer['type']) => {
    switch (type) {
      case 'percentage':
        return Percent;
      case 'buy-x-get-y':
        return Gift;
      case 'fixed-amount':
        return Tag;
      case 'free-item':
        return Gift;
      default:
        return Tag;
    }
  };

  const getOfferDisplayText = (offer: PromotionalOffer) => {
    switch (offer.type) {
      case 'percentage':
        return `${offer.discountPercentage}% OFF`;
      case 'fixed-amount':
        return `$${offer.discountAmount} OFF`;
      case 'buy-x-get-y':
        return `Buy ${offer.buyQuantity} Get ${offer.getQuantity} Free`;
      case 'free-item':
        return `Free ${offer.freeItemName}`;
      default:
        return '';
    }
  };

  if (user?.role !== 'platemaker') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Promotions', headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Only Platemakers can manage promotions</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Promotions', headerShown: false }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Promotional Offers</Text>
            <Text style={styles.subtitle}>Create special deals to attract more customers</Text>
          </View>

          <TouchableOpacity onPress={openCreateModal} style={styles.createButton}>
            <LinearGradient
              colors={monoGradients.green}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Plus size={24} color={Colors.white} />
              <Text style={styles.createButtonText}>Create New Promotion</Text>
            </LinearGradient>
          </TouchableOpacity>

          {offers.length === 0 ? (
            <View style={styles.emptyState}>
              <Tag size={64} color={Colors.gray[300]} />
              <Text style={styles.emptyTitle}>No Promotions Yet</Text>
              <Text style={styles.emptyText}>
                Create your first promotional offer to boost sales and attract customers
              </Text>
            </View>
          ) : (
            <View style={styles.offersList}>
              {offers.map((offer) => {
                const Icon = getOfferIcon(offer.type);
                const isExpired = new Date() > offer.endDate;
                
                return (
                  <View key={offer.id} style={[styles.offerCard, !offer.isActive && styles.offerCardInactive]}>
                    <View style={styles.offerHeader}>
                      <View style={styles.offerIconContainer}>
                        <Icon size={24} color={Colors.gradient.green} />
                      </View>
                      <View style={styles.offerHeaderText}>
                        <Text style={styles.offerTitle}>{offer.title}</Text>
                        <Text style={styles.offerBadge}>{getOfferDisplayText(offer)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteOffer(offer.id)} style={styles.deleteButton}>
                        <Trash2 size={20} color={Colors.error} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.offerDescription}>{offer.description}</Text>

                    <View style={styles.offerDates}>
                      <Calendar size={16} color={Colors.gray[600]} />
                      <Text style={styles.offerDatesText}>
                        {offer.startDate.toLocaleDateString()} - {offer.endDate.toLocaleDateString()}
                      </Text>
                      {isExpired && (
                        <View style={styles.expiredBadge}>
                          <Text style={styles.expiredText}>Expired</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.offerActions}>
                      <TouchableOpacity
                        onPress={() => toggleOfferStatus(offer.id)}
                        style={[styles.statusButton, offer.isActive ? styles.statusButtonActive : styles.statusButtonInactive]}
                      >
                        <Text style={[styles.statusButtonText, offer.isActive ? styles.statusButtonTextActive : styles.statusButtonTextInactive]}>
                          {offer.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEditModal(offer)} style={styles.editButton}>
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingOffer ? 'Edit Promotion' : 'Create Promotion'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={Colors.gray[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <View style={styles.formSection}>
                <Text style={styles.label}>Promotion Type</Text>
                <View style={styles.typeButtons}>
                  {[
                    { type: 'percentage' as const, label: 'Percentage Off', icon: Percent },
                    { type: 'fixed-amount' as const, label: 'Fixed Amount', icon: Tag },
                    { type: 'buy-x-get-y' as const, label: 'Buy X Get Y', icon: Gift },
                    { type: 'free-item' as const, label: 'Free Item', icon: Gift },
                  ].map(({ type, label, icon: Icon }) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setFormData(prev => ({ ...prev, type }))}
                      style={[styles.typeButton, formData.type === type && styles.typeButtonActive]}
                    >
                      <Icon size={20} color={formData.type === type ? Colors.white : Colors.gray[600]} />
                      <Text style={[styles.typeButtonText, formData.type === type && styles.typeButtonTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder="e.g., Summer Special"
                  placeholderTextColor={Colors.gray[400]}
                  style={styles.input}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Describe your promotion"
                  placeholderTextColor={Colors.gray[400]}
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {formData.type === 'percentage' && (
                <View style={styles.formSection}>
                  <Text style={styles.label}>Discount Percentage (%)</Text>
                  <TextInput
                    value={formData.discountPercentage}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, discountPercentage: text.replace(/[^0-9]/g, '') }))}
                    placeholder="e.g., 20"
                    placeholderTextColor={Colors.gray[400]}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              )}

              {formData.type === 'fixed-amount' && (
                <View style={styles.formSection}>
                  <Text style={styles.label}>Discount Amount ($)</Text>
                  <TextInput
                    value={formData.discountAmount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, discountAmount: text.replace(/[^0-9.]/g, '') }))}
                    placeholder="e.g., 5.00"
                    placeholderTextColor={Colors.gray[400]}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              )}

              {formData.type === 'buy-x-get-y' && (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.label}>Buy Quantity</Text>
                    <TextInput
                      value={formData.buyQuantity}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, buyQuantity: text.replace(/[^0-9]/g, '') }))}
                      placeholder="e.g., 2"
                      placeholderTextColor={Colors.gray[400]}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.label}>Get Quantity (Free)</Text>
                    <TextInput
                      value={formData.getQuantity}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, getQuantity: text.replace(/[^0-9]/g, '') }))}
                      placeholder="e.g., 1"
                      placeholderTextColor={Colors.gray[400]}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                </>
              )}

              {formData.type === 'free-item' && (
                <View style={styles.formSection}>
                  <Text style={styles.label}>Free Item Name</Text>
                  <TextInput
                    value={formData.freeItemName}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, freeItemName: text }))}
                    placeholder="e.g., Dessert"
                    placeholderTextColor={Colors.gray[400]}
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.formSection}>
                <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={formData.startDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startDate: text }))}
                  placeholder="2025-10-15"
                  placeholderTextColor={Colors.gray[400]}
                  style={styles.input}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={formData.endDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endDate: text }))}
                  placeholder="2025-10-31"
                  placeholderTextColor={Colors.gray[400]}
                  style={styles.input}
                />
              </View>

              <View style={styles.modalActions}>
                <GradientButton
                  title={editingOffer ? 'Update Promotion' : 'Create Promotion'}
                  onPress={saveOffer}
                  disabled={!validateForm}
                  baseColor="green"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    lineHeight: 22,
  },
  createButton: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.gray[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  offersList: {
    gap: 16,
  },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  offerCardInactive: {
    opacity: 0.6,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  offerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gradient.green + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerHeaderText: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  offerBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gradient.green,
  },
  deleteButton: {
    padding: 8,
  },
  offerDescription: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
    marginBottom: 12,
  },
  offerDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  offerDatesText: {
    fontSize: 13,
    color: Colors.gray[600],
    flex: 1,
  },
  expiredBadge: {
    backgroundColor: Colors.error + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiredText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: Colors.gradient.green + '15',
  },
  statusButtonInactive: {
    backgroundColor: Colors.gray[100],
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: Colors.gradient.green,
  },
  statusButtonTextInactive: {
    color: Colors.gray[600],
  },
  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.gray[100],
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  modalScroll: {
    paddingHorizontal: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.gray[100],
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  typeButtonActive: {
    backgroundColor: Colors.gradient.green,
    borderColor: Colors.gradient.green,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  modalActions: {
    marginTop: 8,
    marginBottom: 32,
  },
});
