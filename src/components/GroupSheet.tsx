import { useState } from 'react';
import { View } from 'react-native';

import { addCategory, deleteGroup, renameGroup } from '../lib/actions.ts';
import type { CategoryGroup } from '../lib/types.ts';
import { useStore } from '../state/store';
import { Button, Field, Sheet, confirm } from './ui';

export function GroupSheet({ groupId, onClose }: { groupId: string | null; onClose: () => void }) {
  const { data } = useStore();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return null;
  return <GroupForm key={group.id} group={group} onClose={onClose} />;
}

function GroupForm({ group, onClose }: { group: CategoryGroup; onClose: () => void }) {
  const { update } = useStore();
  const [name, setName] = useState(group.name);
  const [newCat, setNewCat] = useState('');

  const close = () => {
    if (name.trim() && name.trim() !== group.name) update((d) => renameGroup(d, group.id, name));
    onClose();
  };

  const add = () => {
    if (!newCat.trim()) return;
    update((d) => addCategory(d, group.id, newCat));
    setNewCat('');
  };

  return (
    <Sheet visible title={group.name} onClose={close}>
      <Field label="Add a category" value={newCat} onChangeText={setNewCat} onSubmitEditing={add} placeholder="e.g. Pet food" returnKeyType="done" />
      <Button title="Add category" icon="plus" disabled={!newCat.trim()} onPress={add} style={{ marginBottom: 24 }} />
      <Field label="Group name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button
          title={group.hidden ? 'Unhide group' : 'Hide group'}
          kind="secondary"
          icon={group.hidden ? 'eye' : 'eye-off'}
          style={{ flex: 1 }}
          onPress={() => update((d) => ({ ...d, groups: d.groups.map((g) => (g.id === group.id ? { ...g, hidden: !g.hidden } : g)) }))}
        />
        <Button
          title="Delete"
          kind="danger"
          icon="trash-2"
          style={{ flex: 1 }}
          onPress={() =>
            confirm(`Delete "${group.name}"?`, 'All its categories are deleted too. Their transactions become uncategorized.', 'Delete', () => {
              onClose();
              update((d) => deleteGroup(d, group.id));
            })
          }
        />
      </View>
    </Sheet>
  );
}
