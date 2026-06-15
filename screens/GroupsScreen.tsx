// screens/GroupsScreen.tsx
//
// Groups Management — matches the Stitch "Groups Management with Add Device Modal" mockup.
//
// Features:
//   - Sticky header: bolt + "Matter Home" + wifi icon
//   - Section header "Your Spaces" with device-cluster subtitle
//   - Glass-card grid (1 col) per group:
//       • Group name + member chips with ✕ remove button
//       • Toggle switch → groupOn / groupOff
//       • Delete group button
//   - FAB (bottom-right amber +) → opens "Add Device to Group" bottom sheet
//       • Select Group dropdown (loaded from API)
//       • Select Device dropdown (loaded from API)
//       • "Add to Group" button → POST /api/groups/:groupId/members/:nodeId
//   - Bottom tab bar, "Groups" tab active
//
// API surface used:
//   GET  /api/groups
//   GET  /api/devices
//   POST /api/groups/:groupId/members/:nodeId   (addGroupMember)
//   DELETE /api/groups/:groupId/members/:nodeId (removeGroupMember)
//   POST /api/groups/:groupId/on|off            (groupOn / groupOff)
//   DELETE /api/groups/:groupId                 (deleteGroup)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import { api } from '../api/client';
import { BottomTabBar } from '../components/BottomTabBar';
import type { Group, Device } from '../types';

interface Props {
  navigation: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export function GroupsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [groups, setGroups]   = useState<Group[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible]             = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [grps, devs] = await Promise.all([
        api.getGroups(),
        api.getDevices(false),
      ]);
      setGroups(grps);
      setDevices(devs);
    } catch (err) {
      console.error('[Groups] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Group toggle ───────────────────────────────────────────────────────────
  // We track a per-group "on" state locally, seeded from members being present.
  // (The server doesn't return an aggregate on/off — toggle is best-effort.)
  const [groupOnMap, setGroupOnMap] = useState<Record<number, boolean>>({});

  const handleGroupToggle = useCallback(async (groupId: number) => {
    const isOn = groupOnMap[groupId] ?? false;
    setGroupOnMap(prev => ({ ...prev, [groupId]: !isOn }));
    try {
      if (isOn) {
        await api.groupOff(groupId);
      } else {
        await api.groupOn(groupId);
      }
    } catch (err: any) {
      // Revert on failure
      setGroupOnMap(prev => ({ ...prev, [groupId]: isOn }));
      Alert.alert('Error', err.message ?? 'Group command failed');
    }
  }, [groupOnMap]);

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = useCallback(async (groupId: number, nodeId: string) => {
    // Optimistic update
    setGroups(prev => prev.map(g =>
      g.groupId === groupId
        ? { ...g, members: g.members.filter(m => m !== nodeId) }
        : g
    ));
    try {
      await api.removeGroupMember(groupId, nodeId);
    } catch (err: any) {
      // Revert
      fetchData();
      Alert.alert('Error', err.message ?? 'Failed to remove device from group');
    }
  }, [fetchData]);

  // ── Delete group ───────────────────────────────────────────────────────────
  const handleDeleteGroup = useCallback((groupId: number, name: string) => {
    Alert.alert(
      'Delete Group',
      `Delete "${name}" and remove all its members?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setGroups(prev => prev.filter(g => g.groupId !== groupId));
            try {
              await api.deleteGroup(groupId);
            } catch (err: any) {
              fetchData();
              Alert.alert('Error', err.message ?? 'Failed to delete group');
            }
          },
        },
      ]
    );
  }, [fetchData]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <MaterialSymbols name="lightning-bolt" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Matter Home</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={fetchData} activeOpacity={0.7}>
          <MaterialSymbols name="access-point" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section header ── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Spaces</Text>
            <Text style={styles.sectionSubtitle}>Manage device clusters</Text>
          </View>
        </View>

        {/* ── Groups list ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.groupList}>
            {groups.map(group => (
              <GroupCard
                key={group.groupId}
                group={group}
                devices={devices}
                isOn={groupOnMap[group.groupId] ?? false}
                onToggle={() => handleGroupToggle(group.groupId)}
                onRemoveMember={(nodeId) => handleRemoveMember(group.groupId, nodeId)}
                onDelete={() => handleDeleteGroup(group.groupId, group.name)}
              />
            ))}

            {/* ── Create Group card ── */}
            <TouchableOpacity
              style={styles.createCard}
              onPress={() => setCreateGroupVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.createCardInner}>
                <View style={styles.createCardIcon}>
                  <MaterialSymbols name="plus" size={22} color={Colors.tertiary} />
                </View>
                <View style={styles.createCardText}>
                  <Text style={styles.createCardTitle}>New Group</Text>
                  <Text style={styles.createCardSubtitle}>Create a device cluster</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <MaterialSymbols name="plus" size={28} color={Colors.onTertiary} />
      </TouchableOpacity>

      {/* ── Bottom tab bar ── */}
      <BottomTabBar
        active="groups"
        insetBottom={insets.bottom}
        onNavigate={(tab) => {
          if (tab === 'dashboard')  navigation.navigate('Dashboard');
          if (tab === 'commission') navigation.navigate('Commission');
        }}
      />

      {/* ── Add Device to Group modal ── */}
      <AddDeviceModal
        visible={modalVisible}
        groups={groups}
        devices={devices}
        onDismiss={() => setModalVisible(false)}
        onAdded={() => { setModalVisible(false); fetchData(); }}
      />

      {/* ── Create Group modal ── */}
      <CreateGroupModal
        visible={createGroupVisible}
        nextGroupId={groups.length > 0 ? Math.max(...groups.map(g => g.groupId)) + 1 : 1}
        onDismiss={() => setCreateGroupVisible(false)}
        onCreated={() => { setCreateGroupVisible(false); fetchData(); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupCard
// ─────────────────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group:          Group;
  devices:        Device[];
  isOn:           boolean;
  onToggle:       () => void;
  onRemoveMember: (nodeId: string) => void;
  onDelete:       () => void;
}

function GroupCard({ group, devices, isOn, onToggle, onRemoveMember, onDelete }: GroupCardProps) {
  // Resolve human-readable name for a nodeId
  const deviceName = (nodeId: string) => {
    const found = devices.find(d => d.nodeId === nodeId);
    return found?.name ?? nodeId;
  };

  const activeCount = group.members.length;

  return (
    <View style={styles.card}>
      {/* Glow */}
      {isOn && <View style={styles.cardGlow} />}

      {/* Top row: icon badge only */}
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIconBadge, isOn && styles.cardIconBadgeOn]}>
          <MaterialSymbols
            name="account-group"
            size={22}
            color={isOn ? Colors.primary : Colors.onSurfaceVariant}
          />
        </View>
      </View>

      {/* Group info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{group.name}</Text>
        <View style={styles.cardStatusRow}>
          <View style={[styles.statusDot, activeCount > 0 && styles.statusDotActive]} />
          <Text style={styles.cardStatus}>
            {activeCount === 0
              ? 'No devices'
              : `${activeCount} device${activeCount !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Member chips */}
        {group.members.length > 0 && (
          <View style={styles.chipRow}>
            {group.members.map(nodeId => (
              <View key={nodeId} style={styles.memberChip}>
                <Text style={styles.memberChipText} numberOfLines={1}>
                  {deviceName(nodeId)}
                </Text>
                <TouchableOpacity
                  onPress={() => onRemoveMember(nodeId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialSymbols name="close" size={13} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Footer row: toggle (left) + delete (right) — clearly separated */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          style={[styles.toggleTrack, isOn && styles.toggleTrackOn]}
        >
          <View style={[styles.toggleThumb, isOn && styles.toggleThumbOn]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialSymbols name="delete-outline" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddDeviceModal  — bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

interface AddDeviceModalProps {
  visible:  boolean;
  groups:   Group[];
  devices:  Device[];
  onDismiss: () => void;
  onAdded:   () => void;
}

function AddDeviceModal({ visible, groups, devices, onDismiss, onAdded }: AddDeviceModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedNodeId,  setSelectedNodeId]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset selections when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedGroupId(groups.length > 0 ? groups[0].groupId : null);
      setSelectedNodeId(devices.length > 0 ? devices[0].nodeId : null);
    }
  }, [visible, groups, devices]);

  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim]);

  const handleAdd = useCallback(async () => {
    if (selectedGroupId === null || selectedNodeId === null) {
      Alert.alert('Select both a group and a device');
      return;
    }
    setLoading(true);
    try {
      await api.addGroupMember(selectedGroupId, selectedNodeId);
      onAdded();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to add device to group');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, selectedNodeId, onAdded]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        <Text style={styles.sheetTitle}>Add Device to Group</Text>

        <View style={styles.sheetBody}>
          {/* Select Group */}
          <View style={styles.pickerSection}>
            <Text style={styles.pickerLabel}>Select Group</Text>
            <View style={styles.pickerOptions}>
              {groups.map(g => (
                <TouchableOpacity
                  key={g.groupId}
                  style={[
                    styles.pickerOption,
                    selectedGroupId === g.groupId && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setSelectedGroupId(g.groupId)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedGroupId === g.groupId && styles.pickerOptionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Select Device */}
          <View style={styles.pickerSection}>
            <Text style={styles.pickerLabel}>Select Device</Text>
            <View style={styles.pickerOptions}>
              {devices.map(d => (
                <TouchableOpacity
                  key={d.nodeId}
                  style={[
                    styles.pickerOption,
                    selectedNodeId === d.nodeId && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setSelectedNodeId(d.nodeId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerOptionInner}>
                    <View style={[styles.onlineDot, d.online && styles.onlineDotActive]} />
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedNodeId === d.nodeId && styles.pickerOptionTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.addBtn, (loading || !selectedGroupId || !selectedNodeId) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={loading || !selectedGroupId || !selectedNodeId}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.onPrimary} />
            : <Text style={styles.addBtnText}>Add to Group</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateGroupModal
// ─────────────────────────────────────────────────────────────────────────────

interface CreateGroupModalProps {
  visible:     boolean;
  nextGroupId: number;
  onDismiss:   () => void;
  onCreated:   () => void;
}

function CreateGroupModal({ visible, nextGroupId, onDismiss, onCreated }: CreateGroupModalProps) {
  const [name,    setName]    = useState('');
  const [groupId, setGroupId] = useState(String(nextGroupId));
  const [loading, setLoading] = useState(false);

  // Sync suggested ID when modal opens
  useEffect(() => {
    if (visible) {
      setName('');
      setGroupId(String(nextGroupId));
    }
  }, [visible, nextGroupId]);

  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible, slideAnim]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    const id = parseInt(groupId, 10);

    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    if (isNaN(id) || id < 1 || id > 65527) {
      Alert.alert('Invalid ID', 'Group ID must be a number between 1 and 65527.');
      return;
    }

    setLoading(true);
    try {
      await api.createGroup(id, trimmed);
      onCreated();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }, [name, groupId, onCreated]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Create Group</Text>

          <View style={styles.sheetBody}>
            {/* Group Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Living Room"
                placeholderTextColor={Colors.outline}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
              />
            </View>

            {/* Group ID */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Group ID  <Text style={styles.inputHint}>(1 – 65527)</Text></Text>
              <TextInput
                style={styles.textInput}
                placeholder={String(nextGroupId)}
                placeholderTextColor={Colors.outline}
                value={groupId}
                onChangeText={setGroupId}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addBtn, (!name.trim() || loading) && styles.addBtnDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.onPrimary} />
              : <Text style={styles.addBtnText}>Create Group</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <MaterialSymbols name="account-group-outline" size={48} color={Colors.outline} />
      <Text style={styles.emptyText}>No groups yet. Tap + to create one.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomTabBar
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height:            56,
    backgroundColor:   Colors.background,
  },
  headerIcon: {
    width:          Spacing.touchMin,
    height:         Spacing.touchMin,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   Radius.full,
  },
  headerTitle: {
    ...Typography.headlineLg,
    color: Colors.primary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop:        Spacing.stackMd,
    gap:               Spacing.stackMd,
  },

  // Section header
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   4,
  },
  sectionTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  sectionSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Group list
  groupList: {
    gap: Spacing.gutterMobile,
  },

  // Group card — glass card style
  card: {
    backgroundColor:  'rgba(26,26,26,0.85)',
    borderRadius:     Radius.xl,
    padding:          16,
    borderWidth:      1,
    borderColor:      'rgba(140,144,159,0.12)',
    position:         'relative',
    overflow:         'hidden',
    ...Shadows.card,
  },
  cardGlow: {
    position:     'absolute',
    top:          -40,
    right:        -40,
    width:        128,
    height:       128,
    borderRadius: 64,
    backgroundColor: Colors.primary + '1A',
  },
  cardTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    zIndex:         1,
  },
  cardIconBadge: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: Colors.surfaceElevated,
    alignItems:     'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
  cardIconBadgeOn: {
    backgroundColor: Colors.surfaceContainerHigh,
  },

  // Toggle switch
  toggleTrack: {
    width:           48,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.surfaceVariant,
    justifyContent:  'center',
    padding:         4,
  },
  toggleTrackOn: {
    backgroundColor: Colors.primaryContainer,
  },
  toggleThumb: {
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.onSurfaceVariant,
    ...Shadows.elevated,
  },
  toggleThumbOn: {
    backgroundColor: Colors.onPrimaryContainer,
    transform:       [{ translateX: 24 }],
  },

  // Card body
  cardBody: {
    marginTop: 16,
    zIndex:    1,
  },
  cardName: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  cardStatusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
  },
  statusDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.outline,
  },
  statusDotActive: {
    backgroundColor: Colors.secondary,
  },
  cardStatus: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },

  // Member chips
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginTop:     12,
  },
  memberChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: Colors.surfaceVariant + '4D',
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:    Radius.full,
  },
  memberChipText: {
    ...Typography.labelSm,
    color:    Colors.onSurface,
    maxWidth: 120,
  },

  // Card footer (toggle + delete side-by-side)
  cardFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      16,
    zIndex:         1,
  },

  // Delete button (inside footer)
  deleteBtn: {
    padding: 8,
  },

  // Loading
  loadingContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
    gap:            16,
  },
  emptyText: {
    ...Typography.bodyMd,
    color:     Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth:  260,
  },

  // FAB — amber, matches Stitch design
  fab: {
    position:        'absolute',
    right:           Spacing.marginMobile,
    width:           56,
    height:          56,
    borderRadius:    Radius.xl,
    backgroundColor: Colors.tertiary,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.tertiary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.35,
    shadowRadius:    16,
    elevation:       10,
  },

  // Bottom tab bar styles removed — shared BottomTabBar component handles them

  // ── Modal (bottom sheet) ────────────────────────────────────────────────────

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,15,0.65)',
  },
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: Colors.surfaceCard,
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    padding:         Spacing.marginMobile,
    paddingBottom:   32,
    ...Shadows.card,
  },
  sheetHandle: {
    width:           48,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.outlineVariant + '50',
    alignSelf:       'center',
    marginBottom:    24,
  },
  sheetTitle: {
    ...Typography.headlineMd,
    color:        Colors.onSurface,
    marginBottom: 20,
  },
  sheetBody: {
    gap: 20,
    marginBottom: 24,
  },

  // Picker rows
  pickerSection: {
    gap: 8,
  },
  pickerLabel: {
    ...Typography.labelMd,
    color:        Colors.onSurfaceVariant,
    paddingLeft:  4,
  },
  pickerOptions: {
    gap: 8,
  },
  pickerOption: {
    height:          Spacing.touchMin,
    backgroundColor: Colors.surfaceVariant + '30',
    borderWidth:     1,
    borderColor:     Colors.outlineVariant + '30',
    borderRadius:    Radius.xl,
    paddingHorizontal: 16,
    justifyContent:  'center',
  },
  pickerOptionSelected: {
    borderColor:     Colors.primary,
    backgroundColor: Colors.primaryContainer + '1A',
  },
  pickerOptionInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  pickerOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  pickerOptionTextSelected: {
    color:      Colors.primary,
    fontWeight: '600',
  },
  onlineDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.outline,
  },
  onlineDotActive: {
    backgroundColor: Colors.secondary,
  },

  // Sheet buttons
  addBtn: {
    height:          Spacing.touchMin,
    backgroundColor: Colors.primaryContainer,
    borderRadius:    Radius.xl,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    ...Typography.labelMd,
    color:      Colors.onPrimary,
    fontWeight: '700',
    fontSize:   14,
  },
  cancelBtn: {
    height:          Spacing.touchMin,
    backgroundColor: Colors.surfaceVariant + '80',
    borderRadius:    Radius.xl,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cancelBtnText: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },

  // ── Create Group card ────────────────────────────────────────────────────────
  createCard: {
    borderRadius:    Radius.xl,
    borderWidth:     1.5,
    borderColor:     Colors.tertiary + '50',
    borderStyle:     'dashed',
    padding:         16,
    backgroundColor: Colors.tertiary + '08',
  },
  createCardInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  createCardIcon: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: Colors.tertiary + '20',
    alignItems:     'center',
    justifyContent: 'center',
  },
  createCardText: {
    gap: 2,
  },
  createCardTitle: {
    ...Typography.headlineMd,
    fontSize: 16,
    color:    Colors.tertiary,
  },
  createCardSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },

  // ── Shared text input (CreateGroupModal) ─────────────────────────────────────
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...Typography.labelMd,
    color:       Colors.onSurfaceVariant,
    paddingLeft: 4,
  },
  inputHint: {
    ...Typography.labelMd,
    color:      Colors.outline,
    fontWeight: '400',
  },
  textInput: {
    height:          Spacing.touchMin,
    backgroundColor: Colors.surfaceVariant + '30',
    borderWidth:     1,
    borderColor:     Colors.outlineVariant + '60',
    borderRadius:    Radius.xl,
    paddingHorizontal: 16,
    color:           Colors.onSurface,
    ...Typography.bodyMd,
  },
});
