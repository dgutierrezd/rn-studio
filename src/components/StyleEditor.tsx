import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStudio } from '../StudioProvider';
import { AddPropertyModal } from './AddPropertyModal';
import type { StyleProperty } from '../types';
import { defaultValueFor } from '../data/styleProperties';

/**
 * StyleEditor
 *
 * Scrollable list of editable style properties for the currently
 * selected component, preceded by a "+ Add property" button that opens
 * the searchable RN-wide style picker modal.
 */
export const StyleEditor: React.FC = () => {
  const { selectedComponent, updateStyle, addStyleProperty } = useStudio();
  const [addOpen, setAddOpen] = useState(false);

  if (!selectedComponent) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No component selected</Text>
      </View>
    );
  }

  const existing = selectedComponent.styles.map((s) => s.key);

  const Header = (
    <TouchableOpacity
      style={styles.addButton}
      onPress={() => setAddOpen(true)}
      activeOpacity={0.7}
    >
      <Text style={styles.addPlus}>＋</Text>
      <Text style={styles.addLabel}>Add property</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <FlatList
        data={selectedComponent.styles}
        keyExtractor={(s) => s.key}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            This component has no inline styles yet. Tap "Add property" to
            insert one.
          </Text>
        }
        renderItem={({ item }) => (
          <StyleRow
            property={item}
            onCommit={(value) => updateStyle(item.key, value)}
          />
        )}
      />

      <AddPropertyModal
        visible={addOpen}
        existingKeys={existing}
        onClose={() => setAddOpen(false)}
        onPick={(def) => {
          const value = typeof def.default === 'boolean'
            ? (def.default ? 'true' : 'false')
            : def.default;
          addStyleProperty(def.key, value);
        }}
      />
    </>
  );
};

interface RowProps {
  property: StyleProperty;
  onCommit: (value: string | number) => void;
}

const StyleRow: React.FC<RowProps> = ({ property, onCommit }) => {
  const [value, setValue] = useState(String(property.value));
  const [ackVisible, setAckVisible] = useState(false);
  const debounce = useRef<any>(null);

  useEffect(() => {
    setValue(String(property.value));
  }, [property.value]);

  const schedule = (next: string) => {
    setValue(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const coerced = property.type === 'number' ? Number(next) : next;
      if (property.type === 'number' && Number.isNaN(coerced)) return;
      onCommit(coerced as string | number);
      setAckVisible(true);
      setTimeout(() => setAckVisible(false), 1000);
    }, 300);
  };

  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        {property.type === 'color' && (
          <TouchableOpacity
            style={[
              styles.swatch,
              { backgroundColor: String(property.value) },
            ]}
            activeOpacity={0.7}
          />
        )}
        <Text style={styles.label}>{property.key}</Text>
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={schedule}
          keyboardType={property.type === 'number' ? 'numeric' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor="#7C9BFF"
          placeholderTextColor="#666"
        />
        {ackVisible && <Text style={styles.check}>✓</Text>}
      </View>
    </View>
  );
};

// Suppress unused default-for-import warning — exported for completeness.
export { defaultValueFor };

const styles = StyleSheet.create({
  list: { padding: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  addPlus: {
    color: '#7C9BFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  addLabel: {
    color: '#e5e5e5',
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  label: {
    color: '#ddd',
    fontSize: 14,
    fontFamily: 'Menlo',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#7C9BFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 120,
    textAlign: 'right',
    fontFamily: 'Menlo',
    fontSize: 13,
  },
  check: {
    color: '#7C9BFF',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 13, textAlign: 'center' },
});
