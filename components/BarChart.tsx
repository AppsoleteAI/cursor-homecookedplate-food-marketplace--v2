import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  barColor?: string;
  showValues?: boolean;
  testID?: string;
}

function BarChartBase({ data, height = 160, barColor = Colors.gray[800], showValues = true, testID }: BarChartProps) {
  const max = useMemo(() => Math.max(1, ...data.map(d => d.value)), [data]);

  return (
    <View style={[styles.container, { height }]} testID={testID ?? 'bar-chart'}>
      <View style={styles.barsRow}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 40);
          return (
            <View key={`${d.label}-${i}`} style={styles.barWrapper}>
              <View style={[styles.bar, { height: h, backgroundColor: barColor }]} />
              <Text style={styles.label} numberOfLines={1}>
                {d.label}
              </Text>
              {showValues && (
                <Text style={styles.value}>
                  {d.value === Math.round(d.value) ? d.value : d.value.toFixed(1)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const BarChart = memo(BarChartBase);
export default BarChart;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    marginHorizontal: 4,
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  label: {
    fontSize: 10,
    color: Colors.gray[600],
    marginTop: 6,
  },
  value: {
    fontSize: 10,
    color: Colors.gray[900],
    marginTop: 2,
    fontWeight: '600',
  },
});
