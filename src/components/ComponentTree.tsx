import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStudio } from '../StudioProvider';
import type { ComponentNode } from '../types';

/**
 * ComponentTree
 *
 * Recursive tree view of the selected component and its known
 * source-annotated descendants. Tapping a node re-selects it.
 */
export const ComponentTree: React.FC = () => {
  const { selectedComponent } = useStudio();

  if (!selectedComponent) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No component selected</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TreeNode node={selectedComponent} depth={0} />
    </ScrollView>
  );
};

interface NodeProps {
  node: ComponentNode;
  depth: number;
}

const TreeNode: React.FC<NodeProps> = ({ node, depth }) => {
  const { selectComponent } = useStudio();
  const fileShort = shortenFile(node.source.file);
  return (
    <View>
      <TouchableOpacity
        onPress={() => selectComponent(node)}
        activeOpacity={0.6}
        style={[styles.row, { paddingLeft: 12 + depth * 16 }]}
      >
        <Text style={styles.name}>{node.componentName}</Text>
        <Text style={styles.file} numberOfLines={1}>
          {fileShort}:{node.source.line}
        </Text>
      </TouchableOpacity>
      {node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </View>
  );
};

function shortenFile(file: string): string {
  const parts = file.split('/');
  return parts.slice(-2).join('/');
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },
  row: {
    paddingVertical: 8,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  name: {
    color: '#C6F135',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Menlo',
  },
  file: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Menlo',
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 13 },
});
