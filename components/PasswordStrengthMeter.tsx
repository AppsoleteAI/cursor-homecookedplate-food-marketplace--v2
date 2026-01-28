import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const getPasswordStrength = (password: string) => {
  const requirements = [
    { label: '8+ chars', met: password.length >= 8 },
    { label: 'Upper', met: /[A-Z]/.test(password) },
    { label: 'Lower', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special', met: /[^a-zA-Z0-9]/.test(password) },
  ];

  const score = requirements.filter(r => r.met).length;
  return { requirements, score };
};

export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const { requirements, score } = getPasswordStrength(password);

  const getBarColor = () => {
    if (score <= 2) return '#ff4d4d'; // Red
    if (score <= 4) return '#ffad33'; // Orange/Yellow
    return '#2eb82e'; // Green
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.barBackground}>
        <View 
          style={[
            styles.barActive, 
            { width: `${(score / 5) * 100}%`, backgroundColor: getBarColor() }
          ]} 
        />
      </View>

      {/* Requirement Tags */}
      <View style={styles.requirementGrid}>
        {requirements.map((req, index) => (
          <Text 
            key={index} 
            style={[styles.reqText, { color: req.met ? '#2eb82e' : '#999' }]}
          >
            {req.met ? '✓' : '○'} {req.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 10, width: '100%' },
  barBackground: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  barActive: { height: '100%' },
  requirementGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 10 },
  reqText: { fontSize: 12, fontWeight: '600' }
});

// Export the helper function for use in hooks
export const getPasswordStrengthScore = (password: string) => {
  return getPasswordStrength(password).score;
};
