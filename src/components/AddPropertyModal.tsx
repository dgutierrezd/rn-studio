import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StyleProperty } from '../types';
import {
  STYLE_GROUPS,
  STYLE_PROPERTIES,
  StylePropertyDef,
} from '../data/styleProperties';

interface Props {
  visible: boolean;
  existingKeys: string[];
  onPick: (def: StylePropertyDef) => void;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * AddPropertyModal
 *
 * Full-screen searchable modal listing every RN style property the
 * user might want to add. Groups matching the search are collapsed
 * into a single flat list when a query is active.
 */
export const AddPropertyModal: React.FC<Props> = ({
  visible,
  existingKeys,
  onPick,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const existing = useMemo(() => new Set(existingKeys), [existingKeys]);

  const sections = useMemo(() => {
    const filtered = STYLE_PROPERTIES.filter((p) => !existing.has(p.key));
    const q = query.trim().toLowerCase();
    const matched = q
      ? filtered.filter(
          (p) =>
            p.key.toLowerCase().includes(q) ||
            p.group.toLowerCase().includes(q),
        )
      : filtered;

    // Group by category for display.
    return STYLE_GROUPS.map((group) => ({
      title: group,
      data: matched.filter((p) => p.group === group),
    })).filter((s) => s.data.length > 0);
  }, [existing, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable
          style={styles.sheet}
          // Stop taps inside the sheet from closing the modal.
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add style property</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search properties…"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor="#7C9BFF"
          />

          {sections.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {existing.size > 0 && query === ''
                  ? 'All properties already added.'
                  : 'No matches.'}
              </Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.key}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator
              renderSectionHeader={({ section }) => (
                <Text style={styles.sectionHeader}>{section.title}</Text>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onPick(item);
                    handleClose();
                  }}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowKey}>{item.key}</Text>
                    <Text style={styles.rowType}>{item.type}</Text>
                  </View>
                  <Text style={styles.rowDefault}>
                    = {String(item.default)}
                  </Text>
                </TouchableOpacity>
              )}
              stickySectionHeadersEnabled
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { color: '#fafafa', fontSize: 18, fontWeight: '700' },
  close: { color: '#888', fontSize: 20 },
  search: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#fafafa',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionHeader: {
    color: '#7C9BFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: '#111',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowKey: {
    color: '#fafafa',
    fontSize: 14,
    fontFamily: 'Menlo',
    fontWeight: '500',
  },
  rowType: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  rowDefault: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Menlo',
  },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 13 },
});

// Re-export StyleProperty type in case downstream callers need it.
export type { StyleProperty };
