import React from 'react';
import { Alert } from 'react-native';
import { GradientButton } from '@/components/GradientButton';
import { trpc } from '@/lib/trpc';

interface UserTrialControlProps {
  userId: string;
  extensionDays?: number;
  onSuccess?: (newDate: string) => void;
}

export const UserTrialControl: React.FC<UserTrialControlProps> = ({
  userId,
  extensionDays = 30,
  onSuccess,
}) => {
  const extensionMutation = trpc.admin.extendUserTrial.useMutation({
    onSuccess: (data) => {
      const newDate = new Date(data.newDate);
      const formattedDate = newDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      Alert.alert(
        'Success',
        `Trial extended by ${data.extensionDays} days.\n\nNew expiration date: ${formattedDate}`,
        [{ text: 'OK' }]
      );
      
      if (onSuccess) {
        onSuccess(data.newDate);
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to extend trial. Please try again.');
    },
  });

  const handleExtendTrial = () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is required');
      return;
    }

    Alert.alert(
      'Extend Trial',
      `Extend trial by ${extensionDays} days for this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Extend',
          onPress: () => {
            extensionMutation.mutate({
              userId,
              extensionDays,
            });
          },
        },
      ]
    );
  };

  return (
    <GradientButton
      title={`Extend Trial +${extensionDays} Days`}
      onPress={handleExtendTrial}
      loading={extensionMutation.isPending}
      baseColor="orange"
      disabled={!userId || extensionMutation.isPending}
    />
  );
};
