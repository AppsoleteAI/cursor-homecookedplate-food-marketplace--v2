import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AuthBackButton, AuthBackground } from '@/components/auth/AuthChrome';
import { AuthColors } from '@/constants/auth-palette';
import { FOOD_HANDLING_NOTICE, FOOD_HANDLING_SECTIONS, FOOD_HANDLING_SOURCES } from '@/lib/food-handling';
import { titleCase } from '@/lib/title-case';
import { GlassPressable } from '@/components/glass-surface';

function openSource(url: string) {
  WebBrowser.openBrowserAsync(url).catch((error) => {
    console.error('[food-handling] Unable to open source', error);
  });
}

export default function FoodHandlingScreen() {
  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe} testID="food-handling">
        <Stack.Screen options={{ title: 'Food Handling', headerShown: false }} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AuthBackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} />
          <Text style={styles.brand}>Food Handling</Text>
          <Text style={styles.audience}>Temperatures and hygiene for PlateMakers and PlateTakers</Text>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>How to Read the Numbers</Text>
            <Text style={styles.noticeBody}>{FOOD_HANDLING_NOTICE}</Text>
          </View>

          {FOOD_HANDLING_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{titleCase(section.title)}</Text>
              {section.intro ? <Text style={styles.body}>{section.intro}</Text> : null}
              {section.blocks.map((block) => (
                <View key={block.title} style={styles.rule}>
                  <Text style={styles.ruleTitle}>{titleCase(block.title)}</Text>
                  {block.body ? <Text style={styles.body}>{block.body}</Text> : null}
                  {block.bullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <Text style={styles.bulletMark}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sources</Text>
            <Text style={styles.body}>
              The pages below are the public summaries this guide is drawing from. HomeCookedPlate is not affiliated with them. A chart can be updated. Use the page itself when you need the current figure.
            </Text>
            {FOOD_HANDLING_SOURCES.map((source) => (
              <GlassPressable
                key={source.url}
                style={styles.source}
                onPress={() => openSource(source.url)}
                accessibilityRole="link"
              >
                <Text style={styles.sourceName}>{source.name}</Text>
                <Text style={styles.sourceDetail}>{source.detail}</Text>
                <Text style={styles.sourceUrl}>{source.url}</Text>
              </GlassPressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  brand: {
    color: AuthColors.ink,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  audience: { color: AuthColors.ink, fontSize: 15, marginTop: 4, marginBottom: 14 },
  notice: {
    backgroundColor: AuthColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  noticeTitle: { color: AuthColors.maroon, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  noticeBody: { color: AuthColors.ink, lineHeight: 21 },
  section: {
    backgroundColor: '#FFFBF5',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: { color: AuthColors.ink, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: AuthColors.ink, lineHeight: 21, marginTop: 8 },
  rule: {
    backgroundColor: AuthColors.field,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  ruleTitle: { color: AuthColors.ink, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bulletMark: { color: AuthColors.ink, lineHeight: 21 },
  bulletText: { flex: 1, color: AuthColors.ink, lineHeight: 21 },
  source: {
    borderWidth: 1,
    borderColor: '#E0D3BE',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  sourceName: { color: AuthColors.ink, fontWeight: '700' },
  sourceDetail: { color: AuthColors.ink, lineHeight: 20, marginTop: 4 },
  sourceUrl: { color: '#166534', marginTop: 6 },
});
