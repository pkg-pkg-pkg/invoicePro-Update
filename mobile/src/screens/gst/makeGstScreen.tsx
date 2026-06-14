import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiGetGstReport } from '../../services/api/dataApi';

type Config = { title: string; path: string };

export function makeGstScreen(config: Config) {
  return function GstScreen() {
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [summary, setSummary] = useState('');

    const generate = async () => {
      const data = await apiGetGstReport(config.path, { month, year });
      setSummary(`${data.report}: B2B ${data.b2b.length}, B2C ${data.b2c.length}, HSN ${data.hsnSummary.length}`);
    };

    return (
      <ScreenContainer>
        <Text variant="headlineSmall" style={styles.title}>{config.title}</Text>
        <TextInput label="Month" value={month} onChangeText={setMonth} mode="outlined" style={styles.input} />
        <TextInput label="Year" value={year} onChangeText={setYear} mode="outlined" style={styles.input} />
        <Button mode="contained" onPress={() => void generate()}>Generate Report</Button>
        {!!summary && <Text style={styles.summary}>{summary}</Text>}
        <Button mode="outlined" onPress={() => setSummary(`${config.title} JSON export — use desktop for filing JSON.`)} style={styles.export}>
          Export JSON
        </Button>
      </ScreenContainer>
    );
  };
}

const styles = StyleSheet.create({
  title: { marginBottom: 12 },
  input: { marginBottom: 12 },
  summary: { marginTop: 16, color: '#333' },
  export: { marginTop: 12 },
});
