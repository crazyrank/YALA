import React, { useState } from 'react';
import { View, TextInput, Text } from 'react-native';

export default function FocusTestScreen() {
  const [log, setLog] = useState([]);

  const add = (msg) => {
    const line = `${Date.now() % 100000} ${msg}`;
    console.log(line);
    setLog((prev) => [line, ...prev].slice(0, 30));
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <TextInput
        placeholder="Field A"
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
        onFocus={() => add('A FOCUS')}
        onBlur={() => add('A BLUR')}
      />
      <TextInput
        placeholder="Field B"
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
        onFocus={() => add('B FOCUS')}
        onBlur={() => add('B BLUR')}
      />
      <Text style={{ marginTop: 20, fontFamily: 'monospace', fontSize: 10 }}>
        {log.join('\n')}
      </Text>
    </View>
  );
}
