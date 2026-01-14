import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { MessageCircle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/auth-context';

interface Conversation {
  orderId: string;
  mealName: string;
  mealImage: string;
  otherUserId: string;
  otherUserName: string;
  otherUserImage?: string;
  lastMessage: string;
  lastMessageDate: string;
  unread: boolean;
  orderStatus: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const conversationsQuery = trpc.messages.conversations.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (conversationsQuery.data) {
      setConversations(conversationsQuery.data as Conversation[]);
      setLoading(false);
    } else if (conversationsQuery.isError) {
      setLoading(false);
    }
  }, [conversationsQuery.data, conversationsQuery.isError]);

  const handleConversationPress = useCallback((orderId: string) => {
    router.push({ pathname: '/order/[id]' as const, params: { id: orderId } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Conversation }) => {
    const statusColor = 
      item.orderStatus === 'completed' ? Colors.success :
      item.orderStatus === 'cancelled' ? Colors.error :
      Colors.warning;

    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item.orderId)}
        testID={`conversation-${item.orderId}`}
      >
        <View style={styles.avatarContainer}>
          {item.otherUserImage ? (
            <Image source={{ uri: item.otherUserImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{item.otherUserName[0]?.toUpperCase()}</Text>
            </View>
          )}
          {item.unread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName} numberOfLines={1}>{item.otherUserName}</Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(item.lastMessageDate)}
            </Text>
          </View>
          
          <Text style={styles.mealName} numberOfLines={1}>{item.mealName}</Text>
          
          <Text 
            style={[styles.lastMessage, item.unread && styles.lastMessageUnread]} 
            numberOfLines={2}
          >
            {item.lastMessage}
          </Text>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.orderStatus}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleConversationPress]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Please log in to view messages</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.gradient.green} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Messages',
          headerStyle: { backgroundColor: Colors.white },
        }} 
      />
      
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageCircle size={64} color={Colors.gray[400]} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Your order conversations will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.orderId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gray[200],
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gradient.green,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.gray[900],
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  mealName: {
    fontSize: 13,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 6,
  },
  lastMessageUnread: {
    fontWeight: '600' as const,
    color: Colors.gray[900],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray[100],
    marginLeft: 84,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.gray[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});
