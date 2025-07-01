// TapTalk App Entry - App.tsx with Profile Support
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, Alert, TextInput, ScrollView, useColorScheme, Animated, Easing, Share, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { generateInsight } from '../Taptalk/services/openai';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';




const DEFAULT_TAGS = ['💰 Money', '🧹 Chores', '💬 Misunderstanding', '🧠 Mental Load', '🧍‍♂️ Personal Space'];

interface ConflictEntry {
  timestamp: string;
  tag: string;
}

interface Profile {
  id: string;
  name: string;
  conflicts: ConflictEntry[];
  tags: string[];
  createdAt: string;
}

export default function TapTalkScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [insightModalVisible, setInsightModalVisible] = useState(false);
  const [insightText, setInsightText] = useState('');
  const [insightDateRange, setInsightDateRange] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [showIntro, setShowIntro] = useState(false);

  

  useEffect(() => {
  const loadData = async () => {
    const seenIntro = await AsyncStorage.getItem('hasSeenIntro');
    if (!seenIntro) {
      setShowIntro(true);
    }

    const stored = await AsyncStorage.getItem('profiles');
    if (stored) setProfiles(JSON.parse(stored));
  };
  loadData();
}, []);

const getTrafficColor = (conflicts: ConflictEntry[]): string => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyConflicts = conflicts.filter(c => new Date(c.timestamp) >= oneWeekAgo);
  const count = weeklyConflicts.length;

  if (count === 0) return '#33cc33'; // green
  if (count <= 3) return '#ffcc00'; // yellow
  return '#cc0000'; // red
};


const colorScheme = useColorScheme();

const theme = colorScheme === 'dark'
  ? {
      background: '#000000',
      card: '#1a1a1a',
      text: '#ffffff',
      heading: '#ff99cc',
      primary: '#ff3399',
      border: '#333333',
      inputBackground: '#111111',
      placeholder: '#777',
      subtitle: '#cccccc',
    }
  : {
      background: '#fff0f5',
      card: '#ffe6f0',
      text: '#333333',
      heading: '#660033',
      primary: '#cc0066',
      border: '#ffb6c1',
      inputBackground: '#ffffff',
      placeholder: '#999999',
      subtitle: '#444444',
    };


  const saveProfiles = async (updated: Profile[]) => {
    setProfiles(updated);
    await AsyncStorage.setItem('profiles', JSON.stringify(updated));
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) return;
    const newProfile: Profile = {
      id: uuid.v4().toString(),
      name: newProfileName.trim(),
      conflicts: [],
      tags: [...DEFAULT_TAGS],
      createdAt: new Date().toISOString()
    };
    const updated = [...profiles, newProfile];
    await saveProfiles(updated);
    setSelectedProfile(newProfile);
    setNewProfileName('');
  };

  const logConflict = async (tag: string) => {
    if (!selectedProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedProfiles = profiles.map(p => {
      if (p.id === selectedProfile.id) {
        const newConflict = { timestamp: new Date().toISOString(), tag };
        const updatedConflicts = [...p.conflicts, newConflict];
        return { ...p, conflicts: updatedConflicts };
      }
      return p;
    });
    await saveProfiles(updatedProfiles);
    setSelectedProfile(updatedProfiles.find(p => p.id === selectedProfile.id) || null);
    setModalVisible(false);
  };

  const handleGenerateInsight = async () => {
    if (!selectedProfile) return;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyConflicts = selectedProfile.conflicts.filter(c => new Date(c.timestamp) >= oneWeekAgo);
    const result = await generateInsight(weeklyConflicts);
    setInsightText(result.insight);
    setInsightDateRange(result.dateRange);
    setInsightModalVisible(true);
  };

  const todayCount = selectedProfile?.conflicts.filter(c => {
    const now = new Date();
    const date = new Date(c.timestamp);
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length ?? 0;

  const getSummary = (): [string, number][] => {
    if (!selectedProfile) return [];
    const freq: Record<string, number> = {};
    selectedProfile.conflicts.forEach(c => {
      freq[c.tag] = (freq[c.tag] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  };

  const getFriendlyMessage = (tag: string, count: number): string => {
    if (count >= 5) return `This came up quite a bit. Might be worth discussing.`;
    if (count >= 3) return `A recurring theme to be aware of.`;
    return `Logged a few times.`;
  };
const normalizeTag = (tag: string) => {
  const match = tag.match(/^(\W+)/);
  const emoji = match ? match[1] : '';
  const label = tag.replace(emoji, '').trim().toLowerCase();
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${emoji} ${capitalized}`;
};

const getExportText = () => {
  if (!selectedProfile) return '';


  const freq: Record<string, number> = {};
  selectedProfile.conflicts.forEach(c => {
    const cleanTag = normalizeTag(c.tag);
    freq[cleanTag] = (freq[cleanTag] || 0) + 1;
  });

  const sortedTags = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `• ${tag} – ${count}×`)
    .join('\n');

  return `📝 TapTalk Insight – ${selectedProfile.name}

In the past week, these themes came up the most:

${sortedTags}

✨ Weekly Insight:
"${insightText}"

Reflect. Adjust. Grow.
– Sent from TapTalk 💓`;
};


const shareInsight = async () => {
  try {
    const message = getExportText();
    await Share.share({ message });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    Alert.alert('Error', 'Could not share the insight.');
  }
};


const deleteProfile = async (id: string) => {
  Alert.alert(
    'Delete Profile',
    'Are you sure you want to delete this profile? This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = profiles.filter(p => p.id !== id);
          await saveProfiles(updated);
        }
      }
    ]
  );
};

const ProfileRow = ({ item }: { item: Profile }) => {
  const staticScale = useRef(new Animated.Value(1)).current;
const trafficColor = getTrafficColor(item.conflicts);
  const pulse = useRef(new Animated.Value(1)).current;
  const scaleIn = useRef(new Animated.Value(0.8)).current;

useEffect(() => {
  Animated.timing(scaleIn, {
    toValue: 1,
    duration: 500,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }).start();
}, []);


  useEffect(() => {
  if (trafficColor === '#cc0000') {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ])
    ).start();
  }
}, [item.conflicts]);


  return (
    <Animated.View style={styles.profileRow}>
      <TouchableOpacity onPress={() => setSelectedProfile(item)} style={styles.profileButton}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Animated.View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: getTrafficColor(item.conflicts),
              marginRight: 8,
transform: [{ scale: trafficColor === '#cc0000' ? pulse : staticScale }],            }}
          />
          <View>
  <Text style={styles.profileButtonText}>{item.name}</Text>
  <Text style={[styles.profileMetaText, { color: theme.subtitle, fontSize: 14 }]}>
    {item.conflicts.length} log{item.conflicts.length === 1 ? '' : 's'}
  </Text>
</View>

        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => deleteProfile(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const colorPriority = {
  '#cc0000': 0, // red
  '#ffcc00': 1, // yellow
  '#33cc33': 2, // green
};

const getSortedProfiles = () => {
  return [...profiles].sort((a, b) => {
    const colorA = getTrafficColor(a.conflicts);
    const colorB = getTrafficColor(b.conflicts);
    const priorityA = colorPriority[colorA as keyof typeof colorPriority] ?? 999;
    const priorityB = colorPriority[colorB as keyof typeof colorPriority] ?? 999;
    return priorityA - priorityB;
  });
};




  if (!selectedProfile) {
return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingHorizontal: 20, backgroundColor: theme.background }]}>
          <Text style={[styles.title, { color: theme.primary }]}>💓 TapTalk</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>
            Keep track of emotional moments in your relationships — gently, simply.
          </Text>

          <Text style={styles.section}>🧍 Who is this about?</Text>

          <FlatList
            data={getSortedProfiles()}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => <ProfileRow item={item} />}
            ListFooterComponent={
              <View style={{ marginTop: 40 }}>
                <Text style={styles.section}>➕ Add a new person</Text>

                <TextInput
                  placeholder="e.g. My partner, Sara, Roommate..."
                  placeholderTextColor={theme.placeholder}
                  value={newProfileName}
                  onChangeText={setNewProfileName}
                  style={[
                    styles.tagInput,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                />

                <TouchableOpacity onPress={createProfile} style={[styles.primaryButton, { marginTop: 10 }]}>
                  <Text style={styles.primaryButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );

  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ width: '100%', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
<TouchableOpacity onPress={() => setSelectedProfile(null)} style={{ marginRight: 12 }}>
  <Icon name="arrow-back" size={26} color={theme.primary} />
</TouchableOpacity>
  <Text style={[styles.title, { color: theme.primary }]}>TapTalk – {selectedProfile.name}</Text>
</View>

      <Text style={styles.subtitle}>Conflicts Today: {todayCount}</Text>

      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>+ Log Conflict</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleGenerateInsight} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>🧠 Weekly Insight</Text>
      </TouchableOpacity>

     <Text style={styles.section}>Top Conflict Themes</Text>

{getSummary().length === 0 ? (
  <Text
    style={{
      color: theme.subtitle,
      fontStyle: 'italic',
      textAlign: 'center',
      marginBottom: 20,
    }}
  >
    No conflicts logged yet. Tap "Log Conflict" to get started.
  </Text>
) : (
  <View style={styles.topThemeBanner}>
    <Text style={styles.topThemeText}>💫 Most Common Theme:</Text>
    <Text style={styles.topThemeTag}>
      {getSummary()[0][0]} ({getSummary()[0][1]})
    </Text>
  </View>
)}


      <ScrollView contentContainerStyle={styles.themeList}>
        {getSummary().map(([tag, count], index) => (
          <View key={index} style={[styles.themeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
  <Text style={{ fontSize: 28, marginBottom: 6 }}>{tag}</Text>
  <Text style={{ fontSize: 16, color: theme.primary, fontWeight: '500' }}>{count} logs</Text>
  <Text style={{ fontSize: 14, color: theme.subtitle, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
    {getFriendlyMessage(tag, count)}
  </Text>
</View>

        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="fade" transparent>
  <View style={styles.insightBackdrop}>
    <View style={[styles.insightBox, { backgroundColor: theme.card }]}>
      <Text style={styles.insightTitle}>Select or Add Theme</Text>

      <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingBottom: 10 }}>
        {selectedProfile.tags.map(tag => (
          <View
            key={tag}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
          >
            <TouchableOpacity onPress={() => logConflict(tag)} style={[styles.tagButton, { flex: 1 }]}>
              <Text style={styles.tagText}>{tag}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const updatedProfiles = profiles.map(p => {
                  if (p.id === selectedProfile.id) {
                    return { ...p, tags: p.tags.filter(t => t !== tag) };
                  }
                  return p;
                });
                await saveProfiles(updatedProfiles);
                setSelectedProfile(updatedProfiles.find(p => p.id === selectedProfile.id) || null);
              }}
              style={{ marginLeft: 10 }}
            >
              <Text style={{ fontSize: 18, color: theme.primary }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TextInput
          placeholder="Add new theme"
          value={newTag}
          onChangeText={setNewTag}
          placeholderTextColor="#999"
          style={styles.tagInput}
        />

        <TouchableOpacity
          onPress={async () => {
            if (!newTag.trim()) return;
            const updatedProfiles = profiles.map(p => {
              if (p.id === selectedProfile.id) {
                return { ...p, tags: [...p.tags, newTag.trim()] };
              }
              return p;
            });
            await saveProfiles(updatedProfiles);
            const updatedSelected = updatedProfiles.find(p => p.id === selectedProfile.id) || null;
            setSelectedProfile(updatedSelected);
            setNewTag('');
          }}
          style={[styles.tagButton, { backgroundColor: theme.card, marginTop: 10, borderColor: theme.border }]}
        >
          <Text style={[styles.tagText, { color: theme.primary }]}>+ Add Theme</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
<Modal visible={showIntro} animationType="fade" transparent>
  <View style={styles.insightBackdrop}>
    <View style={[styles.insightBox, { backgroundColor: theme.card }]}>
  <Text style={[styles.insightTitle, { color: theme.primary }]}>Welcome to TapTalk 💓</Text>
      <ScrollView style={{ maxHeight: 300 }}>
        <Text style={styles.insightText}>
          TapTalk helps you gently log emotional conflicts or moments of tension — so you can understand your patterns over time.{"\n\n"}
          Ever said “we always argue about the same thing”? This app helps you actually *see* that pattern, without overthinking.{"\n\n"}
          Just tap a theme, and move on. Weekly insights help you reflect at your own pace.
        </Text>
      </ScrollView>
      <TouchableOpacity
        onPress={async () => {
          await AsyncStorage.setItem('hasSeenIntro', 'true');
          setShowIntro(false);
        }}
        style={styles.okButton}
      >
        <Text style={styles.okButtonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>


      <Modal visible={insightModalVisible} animationType="fade" transparent>
        <View style={styles.insightBackdrop}>
          <View style={[styles.insightBox, { backgroundColor: theme.card }]}>
            <Text style={styles.insightTitle}>💡 Insight</Text>
            <Text style={{ textAlign: 'center', color: '#666', marginBottom: 8 }}>{insightDateRange}</Text>
            <ScrollView style={styles.insightScroll}>
              <Text style={styles.insightText}>{insightText}</Text>
            </ScrollView>
            <TouchableOpacity onPress={shareInsight} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>💌 Share Insight</Text>
      </TouchableOpacity>
            <TouchableOpacity
  onPress={() => {
    setInsightModalVisible(false);
    setInsightText('');
    setInsightDateRange('');
  }}
  style={styles.okButton}
>
  <Text style={styles.okButtonText}>OK</Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#cc0066',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  section: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#cc0066',
    padding: 15,
    borderRadius: 12,
    width: '80%',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
  },
  tagInput: {
    borderWidth: 1,
    borderColor: '#ffb6c1',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginTop: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffe6f0',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  profileButton: {
    flex: 1,
  },
  profileButtonText: {
    fontSize: 18,
    color: '#660033',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#cc0000',
  },
  tagButton: {
    backgroundColor: '#ffe6f0',
    padding: 15,
    borderRadius: 16,
    marginVertical: 6,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ffb6c1',
  },
  tagText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#660033',
    fontWeight: '500',
  },
  insightBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  insightBox: {
    padding: 25,
    borderRadius: 20,
    width: '90%',
  },
  insightTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#cc0066',
    textAlign: 'center',
  },
  insightScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  insightText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  okButton: {
    marginTop: 20,
    backgroundColor: '#cc0066',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
  },
  cancelButtonText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  themeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 10,
  },
  themeCard: {
    backgroundColor: '#ffe6f0',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 120,
  },
  themeEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  themeCount: {
    fontSize: 16,
    color: '#660033',
    fontWeight: '500',
  },
  themeNote: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  topThemeBanner: {
    backgroundColor: '#ffccdd',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
    alignItems: 'center',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  topThemeText: {
    fontSize: 16,
    color: '#660033',
    marginBottom: 4,
    fontWeight: '500',
  },
  topThemeTag: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#cc0066',
  },

  profileMetaText: {
  marginTop: 2,
},
});

