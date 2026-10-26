import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, ScrollView, Share, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Label, ListRow, Sheet, confirm, notify } from '../components/ui';
import { importTransactions, seedData, setCurrency } from '../lib/actions.ts';
import { exportCsv, importCsv } from '../lib/csv.ts';
import { CURRENCIES } from '../lib/money.ts';
import { sampleData } from '../lib/sample.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';

export function SettingsScreen() {
  const { data, update, replace } = useStore();
  const t = useTheme();
  const [importing, setImporting] = useState(false);

  const exportAll = async () => {
    const csv = exportCsv(data);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `allot-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      return;
    }
    await Share.share({ title: 'Allot transactions', message: csv });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}>
      <View>
        <Label>Currency</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} active={data.settings.currency === c} onPress={() => update((d) => setCurrency(d, c))} />
          ))}
        </View>
      </View>

      <View>
        <Label>Your data</Label>
        <Card>
          <ListRow icon="upload" title="Export transactions (CSV)" subtitle="Opens in a spreadsheet" onPress={exportAll} />
          <ListRow icon="download" title="Import transactions (CSV)" subtitle="Paste from your bank's export" onPress={() => setImporting(true)} />
          <ListRow
            icon="play-circle"
            title="Load demo budget"
            subtitle="Replaces everything with sample data"
            onPress={() => confirm('Load demo budget?', 'This replaces all your current data.', 'Load demo', () => replace(sampleData(data.settings.currency)))}
          />
          <ListRow
            icon="trash-2"
            title="Start fresh"
            subtitle="Delete all accounts, transactions and categories"
            onPress={() =>
              confirm('Delete everything?', 'All accounts, transactions and budget amounts are removed. This cannot be undone.', 'Delete all', () =>
                replace({ ...seedData(), settings: data.settings }),
              )
            }
          />
        </Card>
        <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
          Everything is stored on this device only. No account, no servers, no tracking.
        </Text>
      </View>

      <View>
        <Label>The method</Label>
        <Card style={{ padding: 16, gap: 10 }}>
          {[
            ['1', 'Give every dollar a job', 'Assign money you have today until Ready to Assign is zero.'],
            ['2', 'Plan for the big stuff', 'Set targets so irregular bills become small monthly amounts.'],
            ['3', 'Roll with it', 'Overspent? Move money from another category. No guilt.'],
            ['4', 'Spend last month\'s money', 'Build a buffer until this month is paid for by last month.'],
          ].map(([n, title, body]) => (
            <View key={n} style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ color: t.primary, fontWeight: '800', fontSize: 18, width: 16 }}>{n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
                <Text style={{ color: t.muted, lineHeight: 19 }}>{body}</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        Allot {Constants.expoConfig?.version ?? ''} · open source (MIT){'\n'}Not affiliated with any other budgeting app.
      </Text>

      <ImportSheet visible={importing} onClose={() => setImporting(false)} />
    </ScrollView>
  );
}

function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, update } = useStore();
  const t = useTheme();
  const [text, setText] = useState('');
  const accounts = data.accounts.filter((a) => !a.closed);
  const [accountId, setAccountId] = useState('');
  const target = accountId || accounts[0]?.id || '';
  const preview = text.trim() && target ? importCsv(text, data, target) : null;

  const run = () => {
    if (!preview) return;
    update((d) => importTransactions(d, preview.transactions));
    notify('Imported', `${preview.transactions.length} transactions added${preview.skipped ? `, ${preview.skipped} rows skipped` : ''}.`);
    setText('');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Import CSV"
      onClose={onClose}
      footer={<Button title={preview ? `Import ${preview.transactions.length} transactions` : 'Import'} disabled={!preview?.transactions.length} onPress={run} />}
    >
      {accounts.length === 0 ? (
        <Text style={{ color: t.muted }}>Add an account first.</Text>
      ) : (
        <>
          <Text style={{ color: t.muted, lineHeight: 19, marginBottom: 12 }}>
            First row must be headers. Needs <Text style={{ fontWeight: '700' }}>Date</Text>, <Text style={{ fontWeight: '700' }}>Payee</Text> and either{' '}
            <Text style={{ fontWeight: '700' }}>Amount</Text> or <Text style={{ fontWeight: '700' }}>Outflow/Inflow</Text>. Optional: Memo, Category.
          </Text>
          <Label>Into account</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} active={a.id === target} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
          <Field
            label="CSV"
            value={text}
            onChangeText={setText}
            multiline
            placeholder={'Date,Payee,Amount\n2026-10-01,Coffee,-4.50'}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ minHeight: 160, textAlignVertical: 'top', paddingTop: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}
          />
          {preview && preview.skipped > 0 ? <Text style={{ color: t.warning, marginBottom: 8 }}>{preview.skipped} rows can&apos;t be read and will be skipped.</Text> : null}
        </>
      )}
    </Sheet>
  );
}
