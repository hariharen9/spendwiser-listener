import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { 
  Link2, 
  Settings, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  Play, 
  Square,
  Key
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { getSettings, saveSettings, getLog, addToLog, processQueue } from './src/services/api';
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

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

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
            "Permissions Required",
            "SpendWiser Listener needs SMS access to detect bank transaction alerts. Your messages are only checked locally."
          );
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleSaveApiKey = async () => {
    if (!settings) return;
    const newSettings = { ...settings, apiKey: apiKeyInput };
    await saveSettings(newSettings);
    setSettings(newSettings);
    Alert.alert("Success", "API Key saved successfully.");
  };

  const toggleListening = async () => {
    if (!settings) return;
    if (!settings.apiKey && !settings.isListening) {
      Alert.alert("Error", "Please enter an API Key first.");
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

  if (loading || !settings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const getStatusColor = () => {
    if (!settings.apiKey) return '#EAB308'; // yellow
    return settings.isListening ? '#22C55E' : '#EF4444'; // green : red
  };

  const getStatusText = () => {
    if (!settings.apiKey) return 'No API Key';
    return settings.isListening ? 'Listening' : 'Stopped';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      <View style={styles.header}>
        <Link2 size={24} color="#6366F1" />
        <Text style={styles.headerTitle}>SpendWiser Listener</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* API Key Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Key size={20} color="#94A3B8" />
            <Text style={styles.cardTitle}>API Key</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Paste your API key..."
            placeholderTextColor="#64748B"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            secureTextEntry={apiKeyInput.length > 0}
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveApiKey}>
            <Text style={styles.buttonText}>Save Key</Text>
          </TouchableOpacity>
        </View>

        {/* Status Section */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusIndicatorRow}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusValue, { color: getStatusColor() }]}>{getStatusText()}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.toggleButton, { backgroundColor: settings.isListening ? '#EF444420' : '#22C55E20' }]} 
              onPress={toggleListening}
            >
              {settings.isListening ? (
                <Square size={20} color="#EF4444" fill="#EF4444" />
              ) : (
                <Play size={20} color="#22C55E" fill="#22C55E" />
              )}
              <Text style={[styles.toggleButtonText, { color: settings.isListening ? '#EF4444' : '#22C55E' }]}>
                {settings.isListening ? 'Stop' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Log */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.cardHeader}>
            <Activity size={20} color="#94A3B8" />
            <Text style={styles.cardTitle}>Activity Log</Text>
            <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
              <RefreshCw size={18} color="#6366F1" style={refreshing ? { opacity: 0.5 } : {}} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {log.length === 0 ? (
              <Text style={styles.emptyText}>No activity recorded yet.</Text>
            ) : (
              log.map((entry) => (
                <View key={entry.id} style={styles.logEntry}>
                  <View style={styles.logIconRow}>
                    {entry.status === 'success' ? (
                      <ShieldCheck size={16} color="#22C55E" />
                    ) : entry.status === 'queued' ? (
                      <RefreshCw size={16} color="#EAB308" />
                    ) : (
                      <ShieldAlert size={16} color="#EF4444" />
                    )}
                    <Text style={styles.logSummary}>{entry.summary}</Text>
                  </View>
                  <Text style={styles.logTime}>
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {entry.error ? ` • ${entry.error}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderBottomColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 8,
    flex: 1,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleButtonText: {
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  logContainer: {
    marginTop: 8,
  },
  logEntry: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  logIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logSummary: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  logTime: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});
