import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

export type RepairRadioGroupProps<T extends string | null> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  optionStyle?: StyleProp<ViewStyle>;
  selectedOptionStyle?: StyleProp<ViewStyle>;
  disabledOptionStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  selectedTextStyle?: StyleProp<TextStyle>;
};

/** Native presentation only. The caller owns the draft and all mutations. */
export function RepairRadioGroup<T extends string | null>({
  label, options, value, onChange, disabled = false, style,
  optionStyle, selectedOptionStyle, disabledOptionStyle, textStyle, selectedTextStyle,
}: RepairRadioGroupProps<T>) {
  return (
    <View style={style} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <Pressable
            key={option.value ?? "none"}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked, disabled }}
            aria-checked={checked}
            disabled={disabled}
            style={[optionStyle, checked && selectedOptionStyle, disabled && disabledOptionStyle]}
            onPress={() => { if (!disabled) onChange(option.value); }}
          >
            <Text style={[textStyle, checked && selectedTextStyle]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
