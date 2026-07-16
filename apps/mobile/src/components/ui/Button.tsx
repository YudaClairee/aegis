import { Pressable, Text } from 'react-native';
import React from 'react';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function Button({ title, onPress, disabled, variant = 'primary', className }: ButtonProps) {
  const baseStyles =
    'rounded-2xl px-5 py-4 items-center justify-center shadow-sm';
  const variantStyles =
    variant === 'secondary'
      ? 'bg-slate-800 border border-slate-700'
      : 'bg-pink-500';
  const disabledStyles = disabled ? 'opacity-50' : 'opacity-100';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className ?? ''}`.trim()}
    >
      <Text className="text-base font-semibold text-white">{title}</Text>
    </Pressable>
  );
}
