import { Text, TextInput, View, TextInputProps } from 'react-native';
import React from 'react';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, ...props }: TextFieldProps) {
  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-slate-300">{label}</Text>
      <TextInput
        className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-white"
        placeholderTextColor="#94a3b8"
        {...props}
      />
    </View>
  );
}
