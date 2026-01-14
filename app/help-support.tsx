import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useMeals } from '@/hooks/meals-context';
import { useAuth } from '@/hooks/auth-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface FAQ {
  question: string;
  answer: string;
}

interface GuideSection {
  title: string;
  content: string;
}

export default function HelpSupportScreen() {
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const { meals } = useMeals();
  const { user } = useAuth();

  const faqs: FAQ[] = [
    {
      question: 'How do I place an order?',
      answer: 'Browse meals on the Home page, tap on a meal to view details, select quantity, and tap "Add to Cart". Then go to the Cart tab, review your order, and tap "Checkout" to complete your purchase.',
    },
    {
      question: 'How do I create and sell my own meals?',
      answer: 'Create a PlateMaker account then go to the "Create Meal" tab, fill in the meal details including name, description, price, and upload a photo. Add relevant tags and categories. Once submitted, your meal will be available for buyers to purchase.',
    },
    {
      question: 'How do I leave a review for a meal?',
      answer: 'After purchasing a meal, go to your Dashboard and find the meal in "Recent Purchases". Tap on the meal and click the star rating. Select 1-5 stars to open the review page, write your review, and submit.',
    },
    {
      question: 'How do I search for specific meals?',
      answer: 'Use the Search tab to find meals. Type keywords in the search box, or tap the Filter icon to filter by category, price range, rating, or tags. You can combine multiple filters to narrow down results.',
    },
    {
      question: 'How do I manage my cart?',
      answer: 'Go to the Cart tab to view all items. You can adjust quantities using the +/- buttons, remove items with the trash icon, or proceed to checkout. The total price updates automatically.',
    },
    {
      question: 'How do I edit my profile?',
      answer: 'Go to the Profile tab and tap "Edit Profile". You can update your name, email, phone number, bio, and profile picture. Tap "Save Changes" when done.',
    },
    {
      question: 'How do I view my order history?',
      answer: 'Go to the Dashboard tab to see your recent purchases as a buyer, or your created meals and sales as a seller. Tap on any item to view full details.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept all major credit cards, debit cards, and digital payment methods. Payment information is securely processed during checkout.',
    },
    {
      question: 'How do I manage notifications?',
      answer: 'Go to Profile > Settings > Notifications to customize your notification preferences. You can enable/disable notifications for orders, messages, promotions, and updates.',
    },
    {
      question: 'How do I report an issue with an order?',
      answer: 'Contact our support team via Live Chat or Email from the Help & Support page. Provide your order details and describe the issue. Our team will respond within 48 hours.',
    },
  ];

  const userGuide: GuideSection[] = [
    {
      title: 'Getting Started',
      content: 'Welcome to HomeCookedPlate! Create an account to start buying or selling homemade meals. Choose your role as a Buyer, Seller, or Both during signup.',
    },
    {
      title: 'Browsing Meals',
      content: 'The Home tab displays featured meals and categories. Scroll through the carousel to discover popular dishes. Tap any meal card to view full details, ingredients, and reviews.',
    },
    {
      title: 'Searching & Filtering',
      content: 'Use the Search tab to find specific meals. Type keywords or tap the Filter icon to access filters. Filter by category (breakfast, lunch, dinner, dessert, brunch, vegan), price range, rating (1-5 stars), or tags. Tap "Apply Filters" to see results.',
    },
    {
      title: 'Adding to Cart',
      content: 'On a meal detail page, use the +/- buttons to select quantity. Tap "Add to Cart" to add the item. A confirmation will appear. Continue shopping or go to Cart to checkout.',
    },
    {
      title: 'Checkout Process',
      content: 'In the Cart tab, review all items and total price. Adjust quantities or remove items as needed. Tap "Checkout" to proceed to payment. Enter delivery details and payment information to complete your order.',
    },
    {
      title: 'Creating Meals (Sellers)',
      content: 'Go to the "Create Meal" tab. Fill in meal name, description, price, and upload a photo. Add tags for better discoverability. Select a category. Tap "Create Meal" to publish. Your meal will appear in search results immediately.',
    },
    {
      title: 'Managing Your Dashboard',
      content: 'The Dashboard tab shows different views based on your role. Buyers see recent purchases and can reorder or review meals. Sellers see their created meals, sales statistics, and earnings.',
    },
    {
      title: 'Leaving Reviews',
      content: 'After purchasing a meal, go to Dashboard > Recent Purchases. Tap on a meal and click the star rating (1-5 stars). This opens the review page. Write your feedback and tap "Submit Review". You\'ll return to the meal page.',
    },
    {
      title: 'Profile Management',
      content: 'Access your Profile tab to view and edit personal information. Tap "Edit Profile" to update details. Access Settings for app preferences, notifications, privacy, and security options.',
    },
    {
      title: 'Notifications',
      content: 'Tap the bell icon in the header to view notifications. You\'ll receive updates about orders, messages, reviews, and promotions. Manage notification preferences in Settings.',
    },
    {
      title: 'Favorites',
      content: 'Tap the heart icon on any meal card to add it to your favorites. Access your saved meals quickly from your profile for easy reordering.',
    },
    {
      title: 'Support & Help',
      content: 'Need assistance? Visit Help & Support from your Profile. Use Live Chat for immediate help or Email Support for detailed inquiries. Check FAQs for quick answers to common questions.',
    },
  ];

  const handleContactSupport = (method: string) => {
    if (Platform.OS === 'web') {
      window.alert(`Opening ${method}...`);
    } else {
      Alert.alert('Contact Support', `Opening ${method}...`);
    }
  };

  const handleOpenFAQ = () => {
    setShowFAQModal(true);
  };

  const handleOpenGuide = () => {
    setShowGuideModal(true);
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const contactMethods = [
    {
      icon: 'chatbubble-ellipses-outline' as const,
      title: 'Live Chat',
      description: 'Chat with our support team',
      onPress: () => handleContactSupport('Live Chat'),
    },
    {
      icon: 'mail-outline' as const,
      title: 'Email Support',
      description: 'support@homecookedplate.com',
      onPress: () => handleContactSupport('Email'),
    },
  ];

  const resources = [
    {
      icon: 'document-text-outline' as const,
      title: 'FAQs',
      description: 'Find answers to common questions',
      onPress: handleOpenFAQ,
    },
    {
      icon: 'book-outline' as const,
      title: 'User Guide',
      description: 'Learn how to use HomeCookedPlate',
      onPress: handleOpenGuide,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Help & Support',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>How can we help you?</Text>
            <Text style={styles.headerDescription}>
              Our support team is available 24/7 to assist you with any questions or concerns.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            {contactMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactItem}
                onPress={method.onPress}
              >
                <View style={styles.contactLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name={method.icon} size={20} color={Colors.gradient.green} />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactTitle}>{method.title}</Text>
                    <Text style={styles.contactDescription}>{method.description}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resources</Text>
            {resources.map((resource, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactItem}
                onPress={resource.onPress}
              >
                <View style={styles.contactLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name={resource.icon} size={20} color={Colors.info} />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactTitle}>{resource.title}</Text>
                    <Text style={styles.contactDescription}>{resource.description}</Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={20} color={Colors.gray[400]} />
              </TouchableOpacity>
            ))}
          </View>

          {user?.role === 'platemaker' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Ingredients Freshness Docs</Text>
              {user ? (
                meals.filter(m => m.ownerId === user.id).length > 0 ? (
                  meals.filter(m => m.ownerId === user.id).map(m => (
                    <View key={m.id} style={styles.issueCard} testID={`freshness-${m.id}`}>
                      <Text style={styles.issueTitle}>{m.name}</Text>
                      <Text style={styles.issueText}>Expiry: {m.freshness.expiryDate ?? 'N/A'} | Receipt: {m.freshness.receiptDate ?? 'N/A'}</Text>
                      <Text style={[styles.issueText, { marginTop: 4 }]}>Attachments: {m.freshness.attachments.length}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.issueText}>No saved meals yet.</Text>
                )
              ) : (
                <Text style={styles.issueText}>Login to view your documents.</Text>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Common Issues</Text>
            <View style={styles.issueCard}>
              <Text style={styles.issueTitle}>Order Issues</Text>
              <Text style={styles.issueText}>
                Problems with orders, cancellations, or refunds
              </Text>
            </View>
            <View style={styles.issueCard}>
              <Text style={styles.issueTitle}>Payment Issues</Text>
              <Text style={styles.issueText}>
                Payment failures, refunds, or billing questions
              </Text>
            </View>
            <View style={styles.issueCard}>
              <Text style={styles.issueTitle}>Account Issues</Text>
              <Text style={styles.issueText}>
                Login problems, password resets, or account settings
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showFAQModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFAQModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Frequently Asked Questions</Text>
              <TouchableOpacity onPress={() => setShowFAQModal(false)}>
                <Ionicons name="close" size={24} color={Colors.gray[900]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {faqs.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(index)}
                  >
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    {expandedFAQ === index ? (
                      <Ionicons name="chevron-up" size={20} color={Colors.gradient.green} />
                    ) : (
                      <Ionicons name="chevron-down" size={20} color={Colors.gray[400]} />
                    )}
                  </TouchableOpacity>
                  {expandedFAQ === index && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGuideModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Guide</Text>
              <TouchableOpacity onPress={() => setShowGuideModal(false)}>
                <Ionicons name="close" size={24} color={Colors.gray[900]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.guideIntro}>
                This guide will help you navigate and use all features of the HomeCookedPlate app.
              </Text>
              {userGuide.map((section, index) => (
                <View key={index} style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>
                    {index + 1}. {section.title}
                  </Text>
                  <Text style={styles.guideSectionContent}>{section.content}</Text>
                </View>
              ))}
              <View style={styles.guideFooter}>
                <Text style={styles.guideFooterText}>
                  Need more help? Contact our support team via Live Chat or Email.
                </Text>
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
  headerCard: {
    backgroundColor: Colors.gradient.green + '10',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gradient.green + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 13,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  issueCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  issueText: {
    fontSize: 14,
    color: Colors.gray[600],
    lineHeight: 20,
  },
  adminInput: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.gray[900],
    marginTop: 8,
  },
  adminBtn: {
    backgroundColor: Colors.gray[900],
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  adminBtnText: { color: Colors.white, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  modalContent: {
    padding: 20,
  },
  faqItem: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: Colors.gray[50],
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  guideIntro: {
    fontSize: 15,
    color: Colors.gray[700],
    lineHeight: 22,
    marginBottom: 24,
    fontStyle: 'italic' as const,
  },
  guideSection: {
    marginBottom: 24,
  },
  guideSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  guideSectionContent: {
    fontSize: 15,
    color: Colors.gray[700],
    lineHeight: 22,
  },
  guideFooter: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.gradient.green + '10',
    borderRadius: 12,
  },
  guideFooterText: {
    fontSize: 14,
    color: Colors.gray[700],
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
