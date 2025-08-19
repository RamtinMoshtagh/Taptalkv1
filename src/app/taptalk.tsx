// TapTalk Screen - /app/taptalk.tsx (TypeScript version)
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConflictEntry {
  timestamp: string;
  tag: string;
}

const TAGS = ['💰 Money', '🧹 Chores', '💬 Misunderstanding', '🧠 Mental Load', '🧍‍♂️ Personal Space'];

export default function TapTalkScreen(): React.ReactElement {
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem('conflicts');
      if (stored) setConflicts(JSON.parse(stored));
    };
    loadData();
  }, []);

  const logConflict = async (tag: string) => {
    const newEntry: ConflictEntry = { timestamp: new Date().toISOString(), tag };
    const updated = [...conflicts, newEntry];
    setConflicts(updated);
    await AsyncStorage.setItem('conflicts', JSON.stringify(updated));
    setModalVisible(false);
  };

  const todayCount = conflicts.filter((entry) => {
    const today = new Date().toDateString();
    return new Date(entry.timestamp).toDateString() === today;
  }).length;

  const getSummary = (): [string, number][] => {
    const tagCount: Record<string, number> = {};
    conflicts.forEach((entry) => {
      const m = new Date(entry.timestamp).getMonth();
      if (m === new Date().getMonth()) {
        tagCount[entry.tag] = (tagCount[entry.tag] || 0) + 1;
      }
    });
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTalk</Text>
      <Text style={styles.subtitle}>Today's Conflicts: {todayCount}</Text>

      <Button title="Log Conflict" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Conflict Theme</Text>
          {TAGS.map((tag) => (
            <TouchableOpacity key={tag} onPress={() => logConflict(tag)} style={styles.tagButton}>
              <Text style={styles.tagText}>{tag}</Text>
            </TouchableOpacity>
          ))}
          <Button title="Cancel" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>

      <Text style={styles.section}>This Month's Top Themes:</Text>
      <FlatList
        data={getSummary()}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <Text>{item[0]} - {item[1]}</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 18, marginVertical: 10 },
  section: { fontSize: 20, marginTop: 30, marginBottom: 10 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 24, marginBottom: 20 },
  tagButton: { backgroundColor: '#eee', padding: 15, borderRadius: 10, marginVertical: 5, width: '80%' },
  tagText: { fontSize: 18, textAlign: 'center' },
});