import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStudio } from '../StudioProvider';
import { StyleEditor } from './StyleEditor';
import { ComponentTree } from './ComponentTree';

// Reanimated is a declared peer dependency. We attempt to use it for
// the spring-based slide, falling back to the stock Animated API so the
// overlay remains functional in environments where reanimated is not
// yet configured.
let Reanimated: any = null;
let useSharedValue: any = null;
let useAnimatedStyle: any = null;
let withSpring: any = null;
let withTiming: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const r = require('react-native-reanimated');
  Reanimated = r.default;
  useSharedValue = r.useSharedValue;
  useAnimatedStyle = r.useAnimatedStyle;
  withSpring = r.withSpring;
  withTiming = r.withTiming;
} catch {}

type Tab = 'styles' | 'tree' | 'props';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.6;

/**
 * InspectorPanel
 *
 * Bottom sheet shown when a component is selected. Three tabs:
 * Styles | Tree | Props. Slides up with a spring animation.
 */
export const InspectorPanel: React.FC = () => {
  const { selectedComponent, clearSelection } = useStudio();
  const [tab, setTab] = useState<Tab>('styles');

  const visible = !!selectedComponent;

  if (Reanimated && useSharedValue) {
    return (
      <ReanimatedPanel visible={visible} onDismiss={clearSelection} tab={tab} setTab={setTab} />
    );
  }

  // Fallback: render plainly when reanimated is unavailable.
  if (!visible) return null;
  return (
    <View style={[styles.panel, { transform: [{ translateY: 0 }] }]}>
      <PanelChrome tab={tab} setTab={setTab} onDismiss={clearSelection} />
      {tab === 'styles' && <StyleEditor />}
      {tab === 'tree' && <ComponentTree />}
      {tab === 'props' && <PropsView />}
    </View>
  );
};

const ReanimatedPanel: React.FC<{
  visible: boolean;
  onDismiss: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}> = ({ visible, onDismiss, tab, setTab }) => {
  const translateY = useSharedValue(PANEL_HEIGHT);

  useEffect(() => {
    translateY.value = visible
      ? withSpring(0, { damping: 20, stiffness: 200 })
      : withTiming(PANEL_HEIGHT, { duration: 220 });
  }, [visible, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const AnimatedView = Reanimated.View;

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onDismiss}
        style={styles.backdrop}
      />
      <AnimatedView style={[styles.panel, animStyle]}>
        <PanelChrome tab={tab} setTab={setTab} onDismiss={onDismiss} />
        {tab === 'styles' && <StyleEditor />}
        {tab === 'tree' && <ComponentTree />}
        {tab === 'props' && <PropsView />}
      </AnimatedView>
    </>
  );
};

const PanelChrome: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  onDismiss: () => void;
}> = ({ tab, setTab, onDismiss }) => {
  const { selectedComponent } = useStudio();
  return (
    <View>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {selectedComponent ? selectedComponent.componentName : 'Inspector'}
        </Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        <TabButton label="Styles" active={tab === 'styles'} onPress={() => setTab('styles')} />
        <TabButton label="Tree" active={tab === 'tree'} onPress={() => setTab('tree')} />
        <TabButton label="Props" active={tab === 'props'} onPress={() => setTab('props')} />
      </View>
    </View>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({
  label,
  active,
  onPress,
}) => (
  <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const PropsView: React.FC = () => {
  const { selectedComponent } = useStudio();
  if (!selectedComponent) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No component selected</Text>
      </View>
    );
  }
  const entries = Object.entries(selectedComponent.props).filter(
    ([k]) => k !== 'style' && k !== 'children' && k !== '__rnStudioSource'
  );
  if (!entries.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No inspectable props</Text>
      </View>
    );
  }
  return (
    <View style={{ padding: 16 }}>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.propRow}>
          <Text style={styles.propKey}>{k}</Text>
          <Text style={styles.propValue} numberOfLines={2}>
            {safeStringify(v)}
          </Text>
        </View>
      ))}
    </View>
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
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  close: {
    color: '#888',
    fontSize: 18,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#C6F135',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#C6F135',
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 13 },
  propRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  propKey: {
    color: '#C6F135',
    fontSize: 12,
    fontFamily: 'Menlo',
    fontWeight: '600',
  },
  propValue: {
    color: '#ddd',
    fontSize: 12,
    fontFamily: 'Menlo',
    marginTop: 2,
  },
});
