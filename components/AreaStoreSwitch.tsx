import React, { useEffect, useRef } from 'react';
import { Alert, Switch } from 'react-native';
import type { CheckoutArea } from '@/backend/lib/combined-checkout';
import { trpc } from '@/lib/trpc';

export function AreaStoreSwitch({
  area,
  value,
  onValueChange,
  disabled,
  trackColor,
}: {
  area: CheckoutArea;
  value: boolean;
  onValueChange: (open: boolean) => void;
  disabled?: boolean;
  trackColor?: { true: string; false: string };
}) {
  const setStore = trpc.payments.setAreaStore.useMutation();
  const stores = trpc.payments.getAreaStores.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const saved = stores.data?.find((row) => row.area === area)?.open;
  const onChangeRef = useRef(onValueChange);
  onChangeRef.current = onValueChange;

  useEffect(() => {
    if (typeof saved === 'boolean') onChangeRef.current(saved);
  }, [saved]);

  const change = async (open: boolean) => {
    try {
      await setStore.mutateAsync({ area, open });
      onValueChange(open);
    } catch (error) {
      Alert.alert('Store stays closed', error instanceof Error ? error.message : 'This store could not be opened.');
    }
  };

  return (
    <Switch
      value={value}
      onValueChange={change}
      disabled={disabled || setStore.isPending}
      trackColor={trackColor}
    />
  );
}
