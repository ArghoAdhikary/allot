import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionSheet } from './src/components/TransactionSheet';
import { Icon, ScreenHeader, type IconName } from './src/components/ui';
import type { Transaction } from './src/lib/types.ts';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { BudgetScreen } from './src/screens/BudgetScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StoreProvider } from './src/state/store';
import { useTheme } from './src/theme';

type Tab = 'budget' | 'accounts' | 'reports' | 'settings';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'budget', label: 'Budget', icon: 'layers' },
  { key: 'accounts', label: 'Accounts', icon: 'credit-card' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-2' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="auto" />
      <StoreProvider
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.primary} />
          </View>
        }
      >
        <Shell />
      </StoreProvider>
    </View>
  );
}

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('budget');
  const [register, setRegister] = useState<string | null>(null);
  const [txnOpen, setTxnOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();

  const openNew = () => {
    setEditing(undefined);
    setTxnOpen(true);
  };
  const showFab = tab === 'budget' || tab === 'accounts';

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <View style={{ flex: 1 }}>
        {tab === 'accounts' && register ? (
          <RegisterScreen
            accountId={register}
            onBack={() => setRegister(null)}
            onEdit={(tx) => {
              setEditing(tx);
              setTxnOpen(true);
            }}
          />
        ) : (
          <>
            <ScreenHeader title={TABS.find((x) => x.key === tab)!.label} />
            {tab === 'budget' ? <BudgetScreen /> : null}
            {tab === 'accounts' ? <AccountsScreen onOpen={setRegister} /> : null}
            {tab === 'reports' ? <ReportsScreen /> : null}
            {tab === 'settings' ? <SettingsScreen /> : null}
          </>
        )}
      </View>

      {showFab ? (
        <Pressable
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          style={({ pressed }) => [styles.fab, { backgroundColor: t.primary, bottom: 70 + insets.bottom, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="plus" size={28} color={t.onPrimary} />
        </Pressable>
      ) : null}

      <View style={[styles.tabBar, { backgroundColor: t.surface, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((x) => {
          const active = x.key === tab;
          return (
            <Pressable
              key={x.key}
              onPress={() => {
                if (x.key === tab && x.key === 'accounts') setRegister(null);
                setTab(x.key);
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon name={x.icon} size={22} color={active ? t.primary : t.muted} />
              <Text style={{ fontSize: 11, marginTop: 3, color: active ? t.primary : t.muted, fontWeight: active ? '700' : '500' }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TransactionSheet
        visible={txnOpen}
        onClose={() => setTxnOpen(false)}
        editing={editing}
        defaultAccountId={register && register !== 'all' ? register : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
