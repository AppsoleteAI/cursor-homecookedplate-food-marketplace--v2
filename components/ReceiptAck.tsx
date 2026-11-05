import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import {
  PLATEMAKER_RECEIPT_STATEMENT,
  PLATETAKER_RECEIPT_STATEMENT,
  RECEIPT_ACK_COPY,
} from '@/lib/order-closeout';

type Props = {
  role: 'platemaker' | 'platetaker';
  busy?: boolean;
  onSend: () => void;
};

export function ReceiptAck({ role, busy, onSend }: Props) {
  const [checked, setChecked] = useState(false);
  const statement = role === 'platemaker' ? PLATEMAKER_RECEIPT_STATEMENT : PLATETAKER_RECEIPT_STATEMENT;
  return (
    <View style={styles.box}>
      <Text style={styles.copy}>{RECEIPT_ACK_COPY}</Text>
      <GlassPressable
        onPress={() => setChecked((value) => !value)}
        style={styles.row}
        testID={`receipt-check-${role}`}
      >
        <View style={[styles.boxMark, checked && styles.boxMarkOn]}>
          {checked ? <Text style={styles.mark}>✓</Text> : null}
        </View>
        <Text style={styles.statement}>{statement}</Text>
      </GlassPressable>
      <GlassPressable
        onPress={onSend}
        disabled={!checked || busy}
        style={[styles.send, (!checked || busy) && styles.sendOff]}
        testID={`receipt-send-${role}`}
      >
        <Text style={styles.sendText}>Send</Text>
      </GlassPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8 },
  copy: { color: Colors.gray[700], fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  boxMark: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxMarkOn: { backgroundColor: Colors.gradient.green, borderColor: Colors.gradient.green },
  mark: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  statement: { flex: 1, color: Colors.gray[900], fontSize: 14, lineHeight: 20 },
  send: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: Colors.gradient.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendOff: { opacity: 0.45 },
  sendText: { color: Colors.white, fontWeight: '700' },
});
