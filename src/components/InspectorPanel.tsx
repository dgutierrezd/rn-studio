import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStudio } from '../StudioProvider';
import { StyleEditor } from './StyleEditor';
import { ComponentTree } from './ComponentTree';

type Tab = 'styles' | 'tree' | 'props';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.6);

/**
 * InspectorPanel
 *
 * Bottom sheet shown when a component is selected. Three tabs:
 * Styles | Tree | Props. Slides up with a spring animation powered
 * by the stock `Animated` API — no reanimated dependency, so there's
 * no worklets babel plugin requirement on the consumer side.
 */
export const InspectorPanel: React.FC = () => {
  const { selectedComponent, clearSelection } = useStudio();
  const [tab, setTab] = useState<Tab>('styles');
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const visible = !!selectedComponent;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : PANEL_HEIGHT,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
      mass: 1,
    }).start();
  }, [visible, translateY]);

  if (!selectedComponent) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={clearSelection}
        style={styles.backdrop}
      />
      <Animated.View
        style={[styles.panel, { transform: [{ translateY }] }]}
      >
        <PanelChrome
          tab={tab}
          setTab={setTab}
          onDismiss={clearSelection}
        />
        <View style={styles.tabBody}>
          {tab === 'styles' && <StyleEditor />}
          {tab === 'tree' && <ComponentTree />}
          {tab === 'props' && <PropsView />}
        </View>
      </Animated.View>
    </>
  );
};

const PanelChrome: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  onDismiss: () => void;
}> = ({ tab, setTab, onDismiss }) => {
  const {
    selectedComponent,
    undo,
    redo,
    canUndo,
    canRedo,
    hasPendingPreview,
    commitPreview,
    cancelPreview,
  } = useStudio();
  return (
    <View>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {selectedComponent ? selectedComponent.componentName : 'Inspector'}
          </Text>
          {hasPendingPreview && (
            <View style={styles.previewBadge}>
              <View style={styles.previewDot} />
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {hasPendingPreview ? (
            <>
              <TouchableOpacity
                onPress={cancelPreview}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                style={[styles.headerBtn, styles.cancelBtn]}
                accessibilityLabel="Cancel preview"
              >
                <Text style={styles.cancelBtnText}>↺</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={commitPreview}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                style={[styles.headerBtn, styles.commitBtn]}
                accessibilityLabel="Commit preview"
              >
                <Text style={styles.commitBtnText}>✓</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={undo}
                disabled={!canUndo}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                style={[styles.headerBtn, !canUndo && styles.headerBtnDisabled]}
              >
                <Text
                  style={[
                    styles.headerBtnText,
                    !canUndo && styles.headerBtnTextDisabled,
                  ]}
                >
                  ↶
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={redo}
                disabled={!canRedo}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                style={[styles.headerBtn, !canRedo && styles.headerBtnDisabled]}
              >
                <Text
                  style={[
                    styles.headerBtnText,
                    !canRedo && styles.headerBtnTextDisabled,
                  ]}
                >
                  ↷
                </Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tabs}>
        <TabButton
          label="Styles"
          active={tab === 'styles'}
          onPress={() => setTab('styles')}
        />
        <TabButton
          label="Tree"
          active={tab === 'tree'}
          onPress={() => setTab('tree')}
        />
        <TabButton
          label="Props"
          active={tab === 'props'}
          onPress={() => setTab('props')}
        />
      </View>
    </View>
  );
};

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && styles.tabActive]}
    onPress={onPress}
  >
    <Text style={[styles.tabText, active && styles.tabTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const PropsView: React.FC = () => {
  const { selectedComponent } = useStudio();
  if (!selectedComponent) return null;
  const entries = Object.entries(selectedComponent.props || {}).filter(
    ([k]) =>
      k !== 'style' &&
      k !== 'children' &&
      k !== '__rnStudioSource' &&
      k !== '__source' &&
      k !== '__self',
  );
  if (!entries.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No inspectable props</Text>
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator
    >
      {entries.map(([k, v]) => (
        <View key={k} style={styles.propRow}>
          <Text style={styles.propKey}>{k}</Text>
          <Text style={styles.propValue} numberOfLines={4}>
            {safeStringify(v)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

function safeStringify(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'function') return 'ƒ()';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '[object]';
    }
  }
  return String(v);
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: PANEL_HEIGHT,
    backgroundColor: 'transparent',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PANEL_HEIGHT,
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 999998,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  tabBody: { flex: 1, minHeight: 0 },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(124,155,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,155,255,0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C9BFF',
  },
  previewBadgeText: {
    color: '#7C9BFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  headerBtnDisabled: {
    backgroundColor: '#141414',
  },
  headerBtnText: {
    color: '#7C9BFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  headerBtnTextDisabled: {
    color: '#333',
  },
  cancelBtn: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
  },
  cancelBtnText: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  commitBtn: {
    backgroundColor: '#7C9BFF',
  },
  commitBtnText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  close: { color: '#888', fontSize: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7C9BFF' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#7C9BFF' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 13 },
  propRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  propKey: { color: '#7C9BFF', fontSize: 12, fontWeight: '600' },
  propValue: { color: '#ddd', fontSize: 12, marginTop: 2 },
});
