import { tokens } from "@/components/couply-tokens";
import { useId, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RepairRadioGroupProps } from "./RepairRadioGroup";

/** Native HTML radios provide Space/arrow behavior without a second press handler. */
export function RepairRadioGroup<T extends string | null>({
  label, options, value, onChange, disabled = false, style,
  optionStyle, selectedOptionStyle, disabledOptionStyle, textStyle, selectedTextStyle,
}: RepairRadioGroupProps<T>) {
  const name = useId();
  const [focused, setFocused] = useState<number | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabIndex = selectedIndex < 0 ? 0 : selectedIndex;

  return (
    <View style={style} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option, index) => {
        const checked = value === option.value;
        return (
          <View
            key={option.value ?? "none"}
            style={[
              optionStyle, checked && selectedOptionStyle, disabled && disabledOptionStyle,
              focused === index && !disabled && styles.focused,
            ]}
          >
            <input
              type="radio"
              name={name}
              value={option.value ?? "none"}
              aria-label={option.label}
              aria-checked={checked}
              disabled={disabled}
              checked={checked}
              tabIndex={!disabled && index === tabIndex ? 0 : -1}
              onChange={(event) => {
                if (!disabled && event.currentTarget.checked) onChange(option.value);
              }}
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused(null)}
              // The full card is the input's hit target. Opacity preserves the
              // real input in the accessibility tree; the card draws its focus.
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                margin: 0, opacity: 0, zIndex: 1, cursor: disabled ? "default" : "pointer",
              }}
            />
            <Text aria-hidden style={[textStyle, checked && selectedTextStyle]}>
              {option.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  focused: {
    outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2, outlineColor: tokens.colors.plum,
  },
});
