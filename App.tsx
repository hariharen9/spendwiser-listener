import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Animated,
  Easing,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Radio,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Play,
  Square,
  Key,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  Info,
  Lock,
  Server,
  CheckCircle2,
  Filter,
  WifiOff,
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { getSettings, saveSettings, getLog, processQueue } from './src/services/api';
import { AppSettings, ActivityLogEntry } from './src/types';
import { startSmsListener, stopSmsListener, registerQueueTask } from './src/services/background';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pulsing dot component — uses native driver, zero JS thread cost
function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.8, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={{ width: 14, height: 14, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// Static dot for non-listening states
function StaticDot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadData();
    requestPermissions();
    registerQueueTask().catch(console.error);
  }, []);

  const loadData = async () => {
    const s = await getSettings();
    const l = await getLog();
    setSettings(s);
    setLog(l);
    setApiKeyInput(s.apiKey);
    setLoading(false);

    // Auto-expand settings if no API key is set
    if (!s.apiKey) {
      setShowSettings(true);
    }

    if (s.isListening && s.apiKey) {
      startSmsListener();
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);

        if (
          granted['android.permission.RECEIVE_SMS'] !== PermissionsAndroid.RESULTS.GRANTED ||
          granted['android.permission.READ_SMS'] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert(
            'Permissions Required',
            'SpendWiser Listener needs SMS access to detect bank transaction alerts. Your messages are only checked locally — nothing is stored.'
          );
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleSaveApiKey = async () => {
    if (!settings) return;
    if (!apiKeyInput.trim()) {
      Alert.alert('Error', 'Please enter an API Key.');
      return;
    }
    const newSettings = { ...settings, apiKey: apiKeyInput.trim() };
    await saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
    Alert.alert('Saved', 'API Key saved successfully.');
  };

  const toggleListening = async () => {
    if (!settings) return;
    if (!settings.apiKey && !settings.isListening) {
      Alert.alert('Missing Key', 'Please enter an API Key first.');
      setShowSettings(true);
      return;
    }

    const newIsListening = !settings.isListening;
    const newSettings = { ...settings, isListening: newIsListening };
    await saveSettings(newSettings);
    setSettings(newSettings);

    if (newIsListening) {
      startSmsListener();
    } else {
      stopSmsListener();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (settings?.apiKey) {
      await processQueue(settings.apiKey, settings.webhookUrl);
    }
    const l = await getLog();
    setLog(l);
    setRefreshing(false);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading || !settings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const statusColor = !settings.apiKey ? '#FBBF24' : settings.isListening ? '#34D399' : '#F87171';
  const statusText = !settings.apiKey ? 'No API Key' : settings.isListening ? 'Listening' : 'Stopped';
  const successCount = log.filter(e => e.status === 'success').length;
  const queuedCount = log.filter(e => e.status === 'queued').length;
  const filteredCount = log.filter(e => e.status === 'failed' && e.error?.includes('Filtered')).length;

  const renderLogEntry = ({ item }: { item: ActivityLogEntry }) => {
    const isSuccess = item.status === 'success';
    const isQueued = item.status === 'queued';
    const isFiltered = item.status === 'failed' && item.error?.includes('Filtered');
    
    const iconColor = isSuccess ? '#34D399' : isQueued ? '#FBBF24' : '#64748B';
    const Icon = isSuccess ? CheckCircle2 : isQueued ? WifiOff : isFiltered ? Filter : ShieldAlert;

    let displaySummary = item.summary;
    if (isFiltered) {
      const flatText = item.smsText.replace(/\n/g, ' ').trim();
      displaySummary = `💬 "${flatText.length > 40 ? flatText.substring(0, 40) + '...' : flatText}"`;
    }

    return (
      <View style={styles.logEntry}>
        <View style={styles.logTopRow}>
          <View style={[styles.logIconBadge, { backgroundColor: `${iconColor}18` }]}>
            <Icon size={14} color={iconColor} />
          </View>
          <Text style={styles.logSummary} numberOfLines={1}>{displaySummary}</Text>
          <Text style={styles.logTimeAgo}>{getTimeAgo(item.timestamp)}</Text>
        </View>
        {item.error && (
          <Text style={styles.logError} numberOfLines={1}>⚠ {item.error}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
        <StatusBar barStyle="light-content" backgroundColor="#0B1120" translucent />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Radio size={20} color="#818CF8" />
            <Text style={styles.headerTitle}>SpendWiser Listener</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowHelp(true)}
              style={styles.helpButton}
              activeOpacity={0.7}
            >
              <HelpCircle size={20} color="#818CF8" />
            </TouchableOpacity>
            <Text style={styles.headerVersion}>v1.0.3</Text>
          </View>
        </View>

        {/* Status Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroStatusRow}>
              {settings.isListening && settings.apiKey ? (
                <PulsingDot color="#34D399" />
              ) : (
                <StaticDot color={statusColor} />
              )}
              <Text style={[styles.heroStatusText, { color: statusColor }]}>{statusText}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.heroToggle,
                { backgroundColor: settings.isListening ? '#F8717118' : '#34D39918' },
              ]}
              onPress={toggleListening}
              activeOpacity={0.7}
            >
              {settings.isListening ? (
                <Square size={16} color="#F87171" fill="#F87171" />
              ) : (
                <Play size={16} color="#34D399" fill="#34D399" />
              )}
              <Text
                style={[styles.heroToggleText, { color: settings.isListening ? '#F87171' : '#34D399' }]}
              >
                {settings.isListening ? 'Stop' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <CheckCircle2 size={13} color="#34D399" />
              <Text style={styles.statValue}>{successCount}</Text>
              <Text style={styles.statLabel}>Forwarded</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Filter size={13} color="#64748B" />
              <Text style={styles.statValue}>{filteredCount}</Text>
              <Text style={styles.statLabel}>Filtered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <WifiOff size={13} color="#FBBF24" />
              <Text style={styles.statValue}>{queuedCount}</Text>
              <Text style={styles.statLabel}>Queued</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Zap size={13} color="#818CF8" />
              <Text style={styles.statValue}>{log.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Collapsible Settings */}
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setShowSettings(!showSettings)}
          activeOpacity={0.7}
        >
          <View style={styles.collapsibleLeft}>
            <Key size={16} color="#94A3B8" />
            <Text style={styles.collapsibleTitle}>Settings</Text>
            {settings.apiKey ? (
              <View style={styles.keyBadge}>
                <Text style={styles.keyBadgeText}>Key Active</Text>
              </View>
            ) : (
              <View style={[styles.keyBadge, { backgroundColor: '#FBBF2420' }]}>
                <Text style={[styles.keyBadgeText, { color: '#FBBF24' }]}>No Key</Text>
              </View>
            )}
          </View>
          {showSettings ? (
            <ChevronUp size={18} color="#64748B" />
          ) : (
            <ChevronDown size={18} color="#64748B" />
          )}
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsLabel}>API Key</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Paste your API key from SpendWiser…"
                placeholderTextColor="#475569"
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                secureTextEntry={!showApiKey && apiKeyInput.length > 0}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {apiKeyInput.length > 0 && (
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              )}
            </View>
            {settings.apiKey ? (
              <View style={styles.savedKeyRow}>
                <Text style={styles.savedKeyLabel}>Current: </Text>
                <Text style={styles.savedKeyValue}>{maskApiKey(settings.apiKey)}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveApiKey} activeOpacity={0.8}>
              <Text style={styles.saveButtonText}>Save Key</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Activity Log */}
        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <View>
              <Text style={styles.logTitle}>Activity Log</Text>
              <Text style={styles.logSubtitle}>Tap refresh to see latest background events</Text>
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={refreshing}
              style={styles.refreshButton}
              activeOpacity={0.6}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#818CF8" />
              ) : (
                <RefreshCw size={16} color="#818CF8" />
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={log}
            keyExtractor={(item) => item.id}
            renderItem={renderLogEntry}
            contentContainerStyle={log.length === 0 ? styles.emptyListContainer : styles.logList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Radio size={40} color="#1E293B" />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySubtitle}>
                  {settings.isListening
                    ? 'Waiting for bank SMS…'
                    : 'Start listening to capture transactions'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Help Modal */}
        <Modal
          visible={showHelp}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowHelp(false)}
        >
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <HelpCircle size={22} color="#818CF8" />
                  <Text style={styles.modalTitle}>How it works</Text>
                </View>
                <TouchableOpacity onPress={() => setShowHelp(false)} style={styles.closeButton}>
                  <X size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.helpSection}>
                  <View style={styles.helpIconContainer}>
                    <Eye size={24} color="#818CF8" />
                  </View>
                  <View style={styles.helpTextContainer}>
                    <Text style={styles.helpHeading}>Full SMS Visibility</Text>
                    <Text style={styles.helpDescription}>
                      To detect transactions, Android requires permissions to see all incoming SMS.
                      The app "listens" for new messages the moment they arrive.
                    </Text>
                  </View>
                </View>

                <View style={styles.helpSection}>
                  <View style={styles.helpIconContainer}>
                    <Lock size={24} color="#34D399" />
                  </View>
                  <View style={styles.helpTextContainer}>
                    <Text style={styles.helpHeading}>100% Local Filtering</Text>
                    <Text style={styles.helpDescription}>
                      Processing happens entirely on your device. All non-bank messages are
                      instantly ignored and deleted from the app's memory. We never store or read
                      your personal conversations.
                    </Text>
                  </View>
                </View>

                <View style={styles.helpSection}>
                  <View style={styles.helpIconContainer}>
                    <Server size={24} color="#6366F1" />
                  </View>
                  <View style={styles.helpTextContainer}>
                    <Text style={styles.helpHeading}>Secure Forwarding</Text>
                    <Text style={styles.helpDescription}>
                      Only identified bank transactions (e.g., "Rs. 500 debited...") are securely
                      forwarded to your SpendWiser account using your private API key.
                      Nothing else ever leaves your device.
                    </Text>
                  </View>
                </View>

                <View style={styles.helpSection}>
                  <View style={styles.helpIconContainer}>
                    <RefreshCw size={24} color="#FBBF24" />
                  </View>
                  <View style={styles.helpTextContainer}>
                    <Text style={styles.helpHeading}>Background Activity</Text>
                    <Text style={styles.helpDescription}>
                      The app runs as a system service. Background events won't always
                      refresh this UI automatically to save battery. Use the refresh button
                      on the Activity Log to see the latest status.
                    </Text>
                  </View>
                </View>

                <View style={styles.privacyNote}>
                  <ShieldCheck size={18} color="#34D399" />
                  <Text style={styles.privacyNoteText}>
                    Transparent, open-source, and privacy-focused.
                  </Text>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 0.3,
  },
  headerVersion: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  helpButton: {
    padding: 4,
  },

  // Hero Card
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroStatusText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
  },
  heroToggleText: {
    fontWeight: '700',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0B112080',
    borderRadius: 10,
    paddingVertical: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#1E293B',
  },

  // Collapsible Settings
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  collapsibleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  keyBadge: {
    backgroundColor: '#34D39918',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  keyBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Settings Panel
  settingsPanel: {
    marginHorizontal: 16,
    marginTop: 2,
    backgroundColor: '#111827',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#1E293B',
  },
  settingsLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0B1120',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1E293B',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  savedKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  savedKeyLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  savedKeyValue: {
    color: '#818CF8',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // Activity Log
  logSection: {
    flex: 1,
    marginTop: 14,
    marginHorizontal: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  logTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logSubtitle: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#818CF810',
  },
  logList: {
    paddingBottom: 30,
  },
  logEntry: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logSummary: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  logTimeAgo: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
  logError: {
    color: '#F87171',
    fontSize: 11,
    marginTop: 6,
    marginLeft: 38,
    fontWeight: '500',
  },

  // Empty State
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 18,
  },

  // Modal Help Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
  },
  helpSection: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 18,
  },
  helpIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  helpTextContainer: {
    flex: 1,
  },
  helpHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 4,
  },
  helpDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#34D39910',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  privacyNoteText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
});
