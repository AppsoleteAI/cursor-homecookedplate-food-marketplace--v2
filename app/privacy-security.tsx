import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Lock, Eye, Shield, Trash2, Download, ChevronRight, Pause, AlertTriangle, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';


export default function PrivacySecurityScreen() {
  const { user, pauseAccount, unpauseAccount, deleteAccount, setTwoFactorEnabled, changePassword, requestDataExport } = useAuth();
  const router = useRouter();
  const [profileVisibility, setProfileVisibility] = useState<boolean>(true);
  const [showEmail, setShowEmail] = useState<boolean>(false);
  const [accountPaused, setAccountPaused] = useState<boolean>(user?.isPaused ?? false);
  const [twoFA, setTwoFA] = useState<boolean>(user?.twoFactorEnabled ?? false);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [confirmationStep, setConfirmationStep] = useState<1 | 2 | 3>(1);
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [changing, setChanging] = useState<boolean>(false);
  const twoFADisplay = useMemo(() => twoFA, [twoFA]);

  const openChangePassword = useCallback(() => {
    setPasswordModalVisible(true);
  }, []);

  const submitChangePassword = useCallback(async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Change Password', 'New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Change Password', 'New password and confirmation do not match');
      return;
    }
    try {
      setChanging(true);
      const ok = await changePassword(currentPassword, newPassword);
      if (!ok) {
        Alert.alert('Change Password', 'Current password is incorrect');
      } else {
        Alert.alert('Change Password', 'Password updated successfully');
        setPasswordModalVisible(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      Alert.alert('Change Password', 'An unexpected error occurred');
    } finally {
      setChanging(false);
    }
  }, [changePassword, currentPassword, newPassword, confirmPassword]);

  const handleDownloadData = useCallback(async () => {
    try {
      const exportData = await requestDataExport();
      const targetEmail = user?.email ?? '';
      const subject = encodeURIComponent('Your requested data export');
      const body = encodeURIComponent(`Here is your requested data export.\n\n${exportData.content}`);
      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([exportData.content], { type: exportData.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = exportData.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {}
        window.location.href = `mailto:${encodeURIComponent(targetEmail)}?subject=${subject}&body=${body}`;
      } else {
        try {
          await Share.share({ title: 'Your data export', message: exportData.content });
        } catch {}
        const url = `mailto:${encodeURIComponent(targetEmail)}?subject=${subject}&body=${body}`;
        const can = await Linking.canOpenURL(url);
        if (can) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Download My Data', 'Mail app is not available.');
        }
      }
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Failed to prepare your data. Please try again.');
      } else {
        Alert.alert('Download My Data', 'Failed to prepare your data. Please try again.');
      }
    }
  }, [requestDataExport, user?.email]);

  const handlePauseAccount = useCallback(async (value: boolean) => {
    setAccountPaused(value);
    if (value) {
      await pauseAccount();
      if (Platform.OS === 'web') {
        window.alert('Your account has been paused. You can unpause it anytime.');
      } else {
        Alert.alert('Account Paused', 'Your account has been paused. You can unpause it anytime.');
      }
    } else {
      await unpauseAccount();
      if (Platform.OS === 'web') {
        window.alert('Your account has been unpaused.');
      } else {
        Alert.alert('Account Unpaused', 'Your account has been unpaused.');
      }
    }
  }, [pauseAccount, unpauseAccount]);

  const handleDeleteAccount = useCallback(() => {
    setDeleteModalVisible(true);
    setConfirmationStep(1);
  }, []);

  const handleConfirmStep = useCallback(async () => {
    if (confirmationStep === 1) {
      setConfirmationStep(2);
    } else if (confirmationStep === 2) {
      setConfirmationStep(3);
    } else if (confirmationStep === 3) {
      await deleteAccount();
      setDeleteModalVisible(false);
      router.replace('/(auth)/login');
    }
  }, [confirmationStep, deleteAccount, router]);

  const handleCancelDelete = useCallback(() => {
    setDeleteModalVisible(false);
    setConfirmationStep(1);
  }, []);

  const confirmationData = useMemo(() => {
    switch (confirmationStep) {
      case 1:
        return {
          title: 'Delete Account - Step 1 of 3',
          message: 'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.',
          pauseOption: true,
        } as const;
      case 2:
        return {
          title: 'Delete Account - Step 2 of 3',
          message: 'This is your second confirmation. Once deleted, you will lose access to all your meals, orders, and profile information. Are you absolutely sure?',
          pauseOption: false,
        } as const;
      case 3:
        return {
          title: 'Delete Account - Final Confirmation',
          message: 'This is your final chance to cancel. After this confirmation, your account will be permanently deleted and cannot be recovered. Do you want to proceed?',
          pauseOption: false,
        } as const;
    }
  }, [confirmationStep]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Privacy & Security',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Eye size={20} color={Colors.gradient.green} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Profile Visibility</Text>
                  <Text style={styles.settingDescription}>Make your profile visible to others</Text>
                </View>
              </View>
              <Switch
                testID="switch-profile-visibility"
                value={profileVisibility}
                onValueChange={setProfileVisibility}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Eye size={20} color={Colors.gradient.green} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Show Email</Text>
                  <Text style={styles.settingDescription}>Display email on your profile</Text>
                </View>
              </View>
              <Switch
                testID="switch-show-email"
                value={showEmail}
                onValueChange={setShowEmail}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>

            <TouchableOpacity testID="btn-change-password" style={styles.actionItem} onPress={openChangePassword}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Lock size={20} color={Colors.info} />
                </View>
                <Text style={styles.settingTitle}>Change Password</Text>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </TouchableOpacity>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Shield size={20} color={Colors.gradient.green} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>Add extra security to your account</Text>
                </View>
              </View>
              <Switch
                testID="switch-2fa"
                value={twoFADisplay}
                onValueChange={async (v) => {
                  setTwoFA(v);
                  await setTwoFactorEnabled(v);
                }}
                trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Management</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, styles.warningIconContainer]}>
                  <Pause size={20} color={Colors.warning} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Pause Account</Text>
                  <Text style={styles.settingDescription}>Temporarily disable your account</Text>
                </View>
              </View>
              <Switch
                testID="switch-pause-account"
                value={accountPaused}
                onValueChange={handlePauseAccount}
                trackColor={{ false: Colors.gray[300], true: Colors.warning }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>

            <TouchableOpacity testID="btn-download-data" style={styles.actionItem} onPress={handleDownloadData}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Download size={20} color={Colors.gradient.green} />
                </View>
                <Text style={styles.settingTitle}>Download My Data</Text>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </TouchableOpacity>

            <TouchableOpacity testID="btn-delete-account" style={styles.actionItem} onPress={handleDeleteAccount}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, styles.dangerIconContainer]}>
                  <Trash2 size={20} color={Colors.gradient.red} />
                </View>
                <Text style={[styles.settingTitle, styles.dangerText]}>Delete Account</Text>
              </View>
              <ChevronRight size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={handleCancelDelete}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.warningIconLarge}>
                <AlertTriangle size={32} color={Colors.gradient.red} />
              </View>
              <Pressable style={styles.closeButton} onPress={handleCancelDelete}>
                <X size={24} color={Colors.gray[600]} />
              </Pressable>
            </View>

            <Text style={styles.modalTitle}>{confirmationData.title}</Text>
            <Text style={styles.modalMessage}>{confirmationData.message}</Text>

            {confirmationData.pauseOption && (
              <View style={styles.pauseOptionContainer}>
                <View style={styles.pauseOptionIcon}>
                  <Pause size={20} color={Colors.warning} />
                </View>
                <View style={styles.pauseOptionText}>
                  <Text style={styles.pauseOptionTitle}>Consider Pausing Instead</Text>
                  <Text style={styles.pauseOptionDescription}>You can pause your account temporarily instead of deleting it. This way, you can come back anytime.</Text>
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelDelete}>
                <Text style={styles.cancelButtonText}>No, Keep Account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmStep}>
                <Text style={styles.confirmButtonText}>{confirmationStep === 3 ? 'Yes, Delete Forever' : 'Yes, Continue'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, confirmationStep >= 1 && styles.stepDotActive]} />
              <View style={[styles.stepDot, confirmationStep >= 2 && styles.stepDotActive]} />
              <View style={[styles.stepDot, confirmationStep >= 3 && styles.stepDotActive]} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModalVisible} transparent animationType="slide" onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.warningIconLarge}>
                <Lock size={28} color={Colors.info} />
              </View>
              <Pressable style={styles.closeButton} onPress={() => setPasswordModalVisible(false)}>
                <X size={24} color={Colors.gray[600]} />
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                testID="input-current-password"
                style={styles.input}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                testID="input-new-password"
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                testID="input-confirm-password"
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.gray[400]}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={changing} style={styles.confirmButton} onPress={submitChangePassword}>
                <Text style={styles.confirmButtonText}>{changing ? 'Updating…' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  settingLeft: {
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
  dangerIconContainer: {
    backgroundColor: Colors.gradient.red + '15',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray[900],
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.gray[600],
    marginTop: 4,
    lineHeight: 18,
  },
  dangerText: {
    color: Colors.gradient.red,
  },
  warningIconContainer: {
    backgroundColor: Colors.warning + '15',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  warningIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gradient.red + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.gray[700],
    lineHeight: 24,
    marginBottom: 24,
  },
  pauseOptionContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.warning + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  pauseOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseOptionText: {
    flex: 1,
  },
  pauseOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  pauseOptionDescription: {
    fontSize: 13,
    color: Colors.gray[700],
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.gradient.red,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray[300],
  },
  stepDotActive: {
    backgroundColor: Colors.gradient.red,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.gray[700],
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
});