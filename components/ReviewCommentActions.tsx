import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';

type ReviewCommentActionsProps = {
  reviewId: string;
  authorId: string;
  comment: string;
  onChanged?: () => void;
};

export function ReviewCommentActions({ reviewId, authorId, comment, onChanged }: ReviewCommentActionsProps) {
  const { user } = useAuth();
  const report = trpc.reviews.report.useMutation({
    onSuccess: () => {
      Alert.alert('Report', 'This comment was reported. An admin was told.');
      onChanged?.();
    },
    onError: (error) => Alert.alert('Report', error.message),
  });
  const remove = trpc.reviews.deleteComment.useMutation({
    onSuccess: () => {
      Alert.alert('Comment removed', 'The words were removed. The stars stay.');
      onChanged?.();
    },
    onError: (error) => Alert.alert('Comment', error.message),
  });

  if (!user || !comment.trim()) return null;
  const canReport = user.id !== authorId;
  const canDelete = user.isAdmin === true;
  if (!canReport && !canDelete) return null;

  return (
    <View style={styles.row}>
      {canReport ? (
        <GlassPressable
          onPress={() => {
            Alert.alert('Report this comment?', 'An admin can remove the words.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Report', onPress: () => report.mutate({ reviewId }) },
            ]);
          }}
          disabled={report.isPending}
          testID={`report-comment-${reviewId}`}
        >
          <Text style={styles.report}>Report</Text>
        </GlassPressable>
      ) : null}
      {canDelete ? (
        <GlassPressable
          onPress={() => {
            Alert.alert('Delete this comment?', 'The stars stay. The words are removed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => remove.mutate({ reviewId }) },
            ]);
          }}
          disabled={remove.isPending}
          testID={`delete-comment-${reviewId}`}
        >
          <Text style={styles.remove}>Delete</Text>
        </GlassPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  report: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  remove: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9B2C2C',
  },
});
