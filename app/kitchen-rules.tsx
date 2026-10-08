import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AuthBackButton, AuthBackground } from '@/components/auth/AuthChrome';
import { SellerOnly } from '@/components/RoleGuard';
import { AuthColors } from '@/constants/auth-palette';
import { GlassPressable } from '@/components/glass-surface';
import {
  COMMISSARY_DIRECTORIES,
  COMMISSARY_REQUIRED_STATES,
  KITCHEN_RULES_NOTICE,
  LAW_BACKGROUND_SOURCES,
  OTHER_KITCHEN_STARTING_POINTS,
  type ExternalSource,
} from '@/lib/kitchen-rules';

function openSource(url: string) {
  WebBrowser.openBrowserAsync(url).catch((error) => {
    console.error('[kitchen-rules] Unable to open source', error);
  });
}

export default function KitchenRulesScreen() {
  return (
    <SellerOnly>
    <AuthBackground>
    <SafeAreaView style={styles.safe} testID="kitchen-rules">
      <Stack.Screen options={{ title: 'Kitchen Rules', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AuthBackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} />
        <Text style={styles.brand}>Kitchen Rules</Text>
        <Text style={styles.audience}>A resource for PlateMakers</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Read this before you use any link</Text>
          <Text style={styles.noticeBody}>{KITCHEN_RULES_NOTICE}</Text>
          <Text style={styles.noticeBody}>
            This page is background reading for the person cooking. It is not legal advice, not a permit, and not a finding that a meal on HomeCookedPlate was made in a lawful kitchen.
          </Text>
        </View>

        <Section title="What you are listing">
          <Text style={styles.body}>
            A cooked plate is a hot or cold meal. Cottage food law does not cover it. Cottage rules, where they exist, are for homemade shelf-stable foods such as many jams, breads, and granolas, sold by the maker to the final consumer.
          </Text>
          <Text style={styles.body}>
            Hot meals, soups, meat, dairy, and other foods that need temperature control sit under a different rule. Depending on the state, that rule is a microenterprise home kitchen permit, a food-freedom statute, or a requirement to cook in a licensed commercial or shared kitchen. County and city rules can be stricter than the state, and a state law can be written so that each county must opt in before anyone may use it.
          </Text>
          <Text style={styles.body}>
            You are responsible for the kitchen, the permit, the temperature, and the label. The temperatures, glove rules, and container notes are on Food handling. Publishing a meal on this app does not create a cottage exemption and does not replace a health permit. If your state does not allow that food from a residence, the lawful path is a commercially licensed retail kitchen or a permitted shared kitchen, with the agreement and receipts your inspector asks for.
          </Text>
          <GlassPressable onPress={() => router.push('/food-handling' as Href)} testID="kitchen-rules-food-handling">
            <Text style={styles.body}>Open food handling temperatures</Text>
          </GlassPressable>
        </Section>

        <Section title="Commissary and shared kitchens">
          <Text style={styles.body}>
            A commissary or shared commercial kitchen is a licensed facility that more than one food business can use for prep, storage, cleaning, water, and waste. There is no single federal list of these kitchens. Health departments license them locally. The sites below are third-party directories and kitchen operators people use as a starting point.
          </Text>
          <Text style={styles.body}>
            HomeCookedPlate is not affiliated with these sites. We do not manage them, we do not check that a kitchen is still open, and we do not guarantee the rates or the license status they publish. The list is not complete. Call the kitchen and your health department before you sign anything.
          </Text>
          {COMMISSARY_DIRECTORIES.map((source) => (
            <SourceCard key={source.url} source={source} />
          ))}
          <Text style={styles.kicker}>Other places to start</Text>
          <Text style={styles.body}>
            The same notice applies here. A government page is the closer source for a permit. A directory is only a lead.
          </Text>
          {OTHER_KITCHEN_STARTING_POINTS.map((source) => (
            <SourceCard key={source.url} source={source} />
          ))}
          <Text style={styles.body}>
            For an official local list, ask the county health department for its permitted kitchens or approved-commissary roster. Many departments keep that as a public record. Some state agriculture departments also publish food-establishment or co-packer lists.
          </Text>
        </Section>

        <Section title="What to confirm before you rent a kitchen">
          <Bullet text="The kitchen holds a current permit from the health department that would inspect your operation." />
          <Bullet text="The operator will sign a commissary agreement your inspector will accept, and will give you receipts." />
          <Bullet text="The rate covers prep space, and you know what is extra: dry storage, refrigerator, freezer, and parking." />
          <Bullet text="A mobile unit can fill potable water and dump wastewater there, if your permit requires that." />
          <Bullet text="The hours match when you actually cook. A listing that says 24 hours may still book those hours to someone else." />
        </Section>

        <Section title="MEHKO: hot food from a home kitchen, where it exists">
          <Text style={styles.body}>
            MEHKO means Microenterprise Home Kitchen Operation. Published summaries describe it as a permit that can legalize potentially hazardous foods — meat, dairy, and hot-cooked dishes — from a residential kitchen, with public-health limits. It is a different statute from cottage food. It is meant for a very small operation, not for an unlicensed catering company.
          </Text>
          <Bullet text="Volume and revenue caps. California summaries describe a ceiling around 30 meals a day or about 60 to 90 meals a week, and an annual gross around $100,000 to $107,000. The number that binds you is the current statute and your permit, not this page." />
          <Bullet text="An in-person kitchen inspection by the local health department before you open. Cottage registration, where it exists, is often lighter than this." />
          <Bullet text="A certified food-protection manager credential for the operator, and a food-handler card for household members who help, where the local rule requires it." />
          <Bullet text="Sales to the final consumer, for pickup, delivery, or a very small dine-in. Selling your home-cooked hot meals to a cafe or store for resale is described as prohibited." />
          <Text style={styles.body}>
            A state MEHKO statute does not, by itself, make the kitchen legal on your block. California’s AB 626 left the decision to counties. Published summaries say Los Angeles, Santa Clara, and San Diego have issued permits, and that many other California counties have not. Utah’s HB 94 is described as a statewide allowance, with local health departments still handling the permit. Confirm the county, not only the state headline.
          </Text>
          <Text style={styles.body}>
            Published summaries describe California and Utah as the states with an active, structured MEHKO permit for hot food from a residence, with no commissary required when that permit is actually issued. California summaries also describe SB 972, under which a permitted home MEHKO may serve as the commissary for up to two street carts owned by that same cook. That is a narrow exception. It is not a general license to skip a commercial kitchen.
          </Text>
        </Section>

        <Section title="Food freedom: direct sales with a label, where the statute says so">
          <Text style={styles.body}>
            A handful of states use food-freedom statutes instead of a MEHKO permit. Published summaries describe direct-to-consumer sales of home-cooked meals, including some perishable foods, without a health-department license or routine inspection, if the label states that the kitchen is not inspected. Federal rules for meat that must be inspected still apply. Interstate commerce is a separate question.
          </Text>
          <RuleCard
            title="Wyoming"
            body="Summaries describe no sales cap and a wide set of foods, including hot meals, poultry, perishable dairy, and cooked meats, sold direct to the consumer. USDA rules for red meat still apply."
          />
          <RuleCard
            title="North Dakota"
            body="Summaries describe no sales cap for hot meals, perishable foods that need time and temperature control, frozen items, and farm products, sold direct to the consumer. Grocery stores and restaurants are not that channel."
          />
          <RuleCard
            title="Oklahoma"
            body="Summaries of the Local Food Freedom Act describe hot meals and other perishable home-cooked dishes, with an annual cap that those summaries place at $250,000. Confirm the effective date and the cap in the statute before you rely on it. Meat dishes stay on a direct sale."
          />
          <RuleCard
            title="Indiana"
            body="Summaries of 2026 legislation describe a broader home-food rule for some perishable, time-and-temperature-controlled foods. Those same summaries still treat commercial catering and food trucks as operations that need a commissary. Read the enrolled bill and ask the county."
          />
          <RuleCard
            title="Utah, as a hybrid"
            body="Summaries describe food-freedom treatment, including no revenue cap, for some shelf-stable and perishable goods, and a separate MEHKO path when the home kitchen is operating like a hot-food restaurant. The restaurant path still needs local health registration and a kitchen check."
          />
          <RuleCard
            title="Maine, town by town"
            body="Maine’s food-sovereignty statutes are described as local. A town can vote to allow neighbors to sell certain home-prepared foods, including meals, inside town lines. A town that has not voted has not opted in."
          />
        </Section>

        <Section title="Pennsylvania, including Allegheny County">
          <Text style={styles.body}>
            Pennsylvania does not use a traditional cottage food exemption for hot meals. The Limited Food Establishment registration is for non-hazardous, shelf-stable foods. Department of Agriculture materials exclude freshly brewed hot coffee, hot meals, soups, and foods that must be held hot or cold from that home-kitchen registration.
          </Text>
          <Text style={styles.body}>
            In Pennsylvania, a hot-food business from a residential kitchen is not an allowed path under those published rules. That includes Allegheny County and Philadelphia, where the county or city health department licenses retail food. The published route for hot food is a commercially licensed retail facility or a permitted shared commercial kitchen. Confirm the product class with the Pennsylvania Department of Agriculture and with the health department that covers the address where the food is made.
          </Text>
        </Section>

        <Section title="Where hot food from home is described as lawful">
          <Text style={styles.body}>
            Published comparisons sort states into three bands. The bands are a reading aid. They are not a license.
          </Text>
          <RuleCard
            title="Food freedom, broadest published allowance"
            body="Wyoming, North Dakota, and Oklahoma are the states those summaries treat as allowing home-cooked hot meals and other perishable foods on a direct sale, with a label, and without a routine health permit. Caps and meat rules differ. Indiana is described as moving toward perishable home foods in 2026, with commissary rules still in place for commercial catering and trucks."
          />
          <RuleCard
            title="MEHKO and hybrid permits"
            body="California and Utah are described as allowing a home kitchen to function as a very small restaurant after a local permit and inspection. California’s county opt-in means a permit in Los Angeles does not travel to a county that has not authorized the program. Caps are part of the permit."
          />
          <RuleCard
            title="Permissive cottage states, still not hot food"
            body="Florida summaries describe cottage foods with no license or inspection and a large annual sales cap, on the order of $250,000, for the foods the cottage statute allows. Georgia summaries describe direct home baking with no state cap, no state license, and no inspection, including some sales through a local store. Those are cottage permissions. They are not permission to sell hot meals from a residence."
          />
        </Section>

        <Section title="When the law points you to a commissary">
          <Text style={styles.body}>
            If a health department requires a contract with a licensed commissary, the business is a commercial food operation: catering, a mobile vendor, or a ghost kitchen. It is not a home kitchen business. Industry summaries say that in most states the rule for those operations is simple: no commissary agreement, no health permit. Residential kitchens are off limits for that hot food.
          </Text>
          <Text style={styles.body}>
            Those summaries name the states below as places where a mobile food unit, catering business, or ghost kitchen is expected to hold a commissary agreement before a retail food license is issued. This app has not verified each statute. California is on the list for trucks and caterers, with the separate county MEHKO permit as the published home-kitchen exception. Indiana is on the list for commercial catering and trucks even where home perishable sales are expanding.
          </Text>
          <GlassPressable onPress={() => router.push('/food-truck-popup/permit' as Href)} testID="kitchen-rules-food-truck">
            <Text style={styles.body}>Food trucks sell through FoodTruckPopup. The menu stays closed until the mobile permit, commissary answer, and fee are recorded.</Text>
          </GlassPressable>
          <GlassPressable onPress={() => router.push('/sit-down-delicious/license' as Href)} testID="kitchen-rules-sit-down">
            <Text style={styles.body}>A sit-down or takeout restaurant sells through SitDownDelicious. The license is the retail food permit for that street address. Cottage food law and a mobile-unit permit do not authorize it.</Text>
          </GlassPressable>
          <Text style={styles.states}>{COMMISSARY_REQUIRED_STATES.join(' · ')}</Text>
          <Text style={styles.body}>
            Montana is not classified in the summaries this page is drawing from. Washington, D.C. is not in that state list either. If you cook in either place, ask the local health department directly.
          </Text>
          <Text style={styles.kicker}>Published exceptions to a brick-and-mortar commissary</Text>
          <Bullet text="Wyoming, North Dakota, and Oklahoma: food-freedom sales from home, direct to the consumer, inside the statute’s foods and caps." />
          <Bullet text="Utah: a statewide MEHKO permit for a residential hot-food micro-restaurant, after local registration and a kitchen check." />
          <Bullet text="Ohio: summaries describe a food truck that may operate without a separate commissary when the unit is fully self-contained — water, waste, and commercial prep equipment — and the state has approved that unit." />
          <Bullet text="Maine: a town food-sovereignty ordinance, and only inside a town that has voted for it." />
          <Text style={styles.body}>
            A few other states allow a narrow home path for some refrigerated foods without becoming a hot-food restaurant. Texas and Arizona summaries describe certain temperature-controlled cottage items, such as some cut produce or specific baked goods, after a food-handler course and strict labels. They do not describe a general right to sell hot meals from home. Ohio summaries also describe lighter rules for the direct online sale of home-baked goods. None of those notes replace the health code for a cooked plate.
          </Text>
        </Section>

        <Section title="Background reading">
          <Text style={styles.body}>
            The pages below are the public summaries this guide is drawing from. HomeCookedPlate is not affiliated with them. They can be wrong, outdated, or written for a different kind of business than yours. Read the statute and call the agency.
          </Text>
          {LAW_BACKGROUND_SOURCES.map((source) => (
            <SourceCard key={source.url} source={source} />
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
    </AuthBackground>
    </SellerOnly>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function RuleCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function SourceCard({ source }: { source: ExternalSource }) {
  return (
    <GlassPressable style={styles.source} onPress={() => openSource(source.url)} accessibilityRole="link">
      <Text style={styles.sourceName}>{source.name}</Text>
      <Text style={styles.sourceDetail}>{source.detail}</Text>
      <Text style={styles.sourceUrl}>{source.url}</Text>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  brand: {
    color: AuthColors.brand,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  audience: { color: AuthColors.onDark, fontSize: 15, marginTop: 4, marginBottom: 14 },
  notice: {
    backgroundColor: AuthColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  noticeTitle: { color: AuthColors.maroon, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  noticeBody: { color: AuthColors.ink, lineHeight: 21, marginTop: 8 },
  section: {
    backgroundColor: '#FFFBF5',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: { color: AuthColors.ink, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: AuthColors.ink, lineHeight: 21, marginTop: 8 },
  kicker: { color: AuthColors.ink, fontWeight: '700', marginTop: 16 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bulletMark: { color: AuthColors.ink, lineHeight: 21 },
  bulletText: { flex: 1, color: AuthColors.ink, lineHeight: 21 },
  rule: {
    backgroundColor: AuthColors.field,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  ruleTitle: { color: AuthColors.ink, fontWeight: '700' },
  states: { color: AuthColors.ink, lineHeight: 21, marginTop: 10 },
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
