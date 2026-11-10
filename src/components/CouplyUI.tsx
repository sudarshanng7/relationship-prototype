import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
import React from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

/* --------------------------------------------------
   A. CouplyPage
   -------------------------------------------------- */
export interface CouplyPageProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  safe?: boolean;
}

export function CouplyPage({
  children,
  style,
  contentStyle,
  safe = true,
}: CouplyPageProps) {
  const { theme } = useTheme();
  const Container = safe ? SafeAreaView : View;
  return (
    <Container
      style={[
        styles.pageWrapper,
        { backgroundColor: theme.pageBackground },
        style,
      ]}
    >
      <View style={[styles.pageContent, contentStyle]}>{children}</View>
    </Container>
  );
}

/* --------------------------------------------------
   B. CouplyHeader
   -------------------------------------------------- */
export interface CouplyHeaderProps {
  overline?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  backTextStyle?: StyleProp<TextStyle>;
}

export function CouplyHeader({
  overline,
  title,
  subtitle,
  onBack,
  backLabel = "‹ Back",
  rightSlot,
  style,
  titleStyle,
  subtitleStyle,
  backTextStyle,
}: CouplyHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.headerContainer, style]}>
      {onBack && (
        <View style={styles.headerTopRow}>
          <Pressable
            style={({ pressed }) => [
              styles.headerBackBtn,
              pressed && styles.headerBackBtnPressed,
            ]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            <Text
              style={[
                styles.headerBackText,
                { color: theme.primaryAccent },
                backTextStyle,
              ]}
            >
              {backLabel}
            </Text>
          </Pressable>
          {rightSlot && <View style={styles.headerRightSlot}>{rightSlot}</View>}
        </View>
      )}

      {overline ? (
        <Text
          style={[styles.headerOverline, { color: theme.primaryAccent }]}
        >
          {overline}
        </Text>
      ) : null}
      <View style={styles.headerTitleRow}>
        <Text
          style={[
            styles.headerTitle,
            { color: theme.primaryText },
            titleStyle,
          ]}
        >
          {title}
        </Text>
        {!onBack && rightSlot ? (
          <View style={styles.headerRightSlot}>{rightSlot}</View>
        ) : null}
      </View>
      {subtitle ? (
        <Text
          style={[
            styles.headerSubtitle,
            { color: theme.secondaryText },
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------
   C. CouplySectionCard
   -------------------------------------------------- */
export interface CouplySectionCardProps {
  children: React.ReactNode;
  variant?: "default" | "lilac" | "blush" | "muted";
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

export function CouplySectionCard({
  children,
  variant = "default",
  style,
  onLayout,
  testID,
}: CouplySectionCardProps) {
  const { theme } = useTheme();

  const cardBg =
    variant === "lilac"
      ? theme.secondarySurface
      : variant === "blush"
        ? theme.blushSurface
        : variant === "muted"
          ? theme.secondarySurface
          : theme.surface;

  const cardBorder =
    variant === "lilac" || variant === "blush"
      ? theme.borderSoft
      : theme.border;

  return (
    <View
      style={[
        styles.cardBase,
        { backgroundColor: cardBg, borderColor: cardBorder },
        style,
      ]}
      onLayout={onLayout}
      testID={testID}
    >
      {children}
    </View>
  );
}

/* --------------------------------------------------
   D. CouplyPrimaryButton
   -------------------------------------------------- */
export interface CouplyPrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function CouplyPrimaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  loading = false,
  style,
  textStyle,
}: CouplyPrimaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: theme.primaryAccent },
        pressed && !isDisabled && { backgroundColor: theme.pressedAccent },
        isDisabled && styles.primaryButtonDisabled,
        style,
      ]}
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.primaryActionText} />
      ) : (
        <Text
          style={[
            styles.primaryButtonText,
            { color: theme.primaryActionText },
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* --------------------------------------------------
   E. CouplyQuietButton
   -------------------------------------------------- */
export interface CouplyQuietButtonProps {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: "soft" | "text";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function CouplyQuietButton({
  label,
  onPress,
  accessibilityLabel,
  variant = "soft",
  disabled = false,
  style,
  textStyle,
}: CouplyQuietButtonProps) {
  const { theme } = useTheme();
  const isSoft = variant === "soft";

  return (
    <Pressable
      style={({ pressed }) => [
        isSoft
          ? [
              styles.quietButtonSoft,
              {
                backgroundColor: theme.secondarySurface,
                borderColor: theme.border,
              },
            ]
          : styles.quietButtonText,
        pressed &&
          !disabled &&
          (isSoft
            ? {
                backgroundColor: theme.borderSoft,
                borderColor: theme.primaryAccent,
              }
            : { opacity: 0.7 }),
        disabled && styles.quietButtonDisabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Text
        style={[
          isSoft
            ? [styles.quietButtonSoftText, { color: theme.primaryAccent }]
            : [styles.quietButtonPlainText, { color: theme.secondaryText }],
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------------------------
   F. CouplyStatusPill
   -------------------------------------------------- */
export type CouplyStatusVariant =
  | "neutral"
  | "open"
  | "softening"
  | "inCare"
  | "reconnecting"
  | "reconnected"
  | "positive"
  | "celebration"
  | "error"
  | "preview";

export interface CouplyStatusPillProps {
  label: string;
  variant?: CouplyStatusVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function CouplyStatusPill({
  label,
  variant = "neutral",
  style,
  textStyle,
}: CouplyStatusPillProps) {
  const { theme } = useTheme();

  const config =
    variant === "open"
      ? theme.status.open
      : variant === "softening" || variant === "inCare"
        ? theme.status.inCare
        : variant === "reconnecting"
          ? theme.status.reconnecting
          : variant === "reconnected"
            ? theme.status.reconnected
            : variant === "positive" || variant === "celebration"
              ? theme.status.celebration
              : variant === "error"
                ? theme.status.error
                : variant === "preview"
                  ? theme.status.preview
                  : theme.status.neutral;

  return (
    <View
      style={[
        styles.pillBase,
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      <Text style={[styles.pillBaseText, { color: config.text }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

/* --------------------------------------------------
   G. CouplyEmptyState
   -------------------------------------------------- */
export interface CouplyEmptyStateProps {
  title: string;
  body: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CouplyEmptyState({
  title,
  body,
  action,
  style,
}: CouplyEmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.emptyContainer,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>
        {title}
      </Text>
      <Text style={[styles.emptyBody, { color: theme.secondaryText }]}>
        {body}
      </Text>
      {action ? <View style={styles.emptyActionRow}>{action}</View> : null}
    </View>
  );
}

/* --------------------------------------------------
   H. CouplyChoiceCard
   -------------------------------------------------- */
export interface CouplyChoiceCardProps {
  title: string;
  description?: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  badge?: string;
  accessibilityRole?: "button" | "radio" | "checkbox" | "tab";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
}

export function CouplyChoiceCard({
  title,
  description,
  selected = false,
  onPress,
  icon,
  badge,
  accessibilityRole = "button",
  accessibilityLabel,
  style,
  testID,
  disabled = false,
}: CouplyChoiceCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          backgroundColor: selected
            ? theme.secondarySurface
            : theme.surface,
          borderColor: selected ? theme.primaryAccent : theme.border,
          borderWidth: selected ? 1.6 : 1.2,
        },
        pressed &&
          !disabled && {
            backgroundColor: selected
              ? theme.borderSoft
              : theme.secondarySurface,
          },
        disabled && styles.choiceCardDisabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={
        accessibilityLabel ||
        (description ? `${title}: ${description}` : title)
      }
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
    >
      <View style={styles.choiceCardContent}>
        <View style={styles.choiceCardHeader}>
          {icon ? <View style={styles.choiceCardIcon}>{icon}</View> : null}
          <View style={styles.choiceCardTextCol}>
            <Text
              style={[
                styles.choiceCardTitle,
                { color: selected ? theme.primaryAccent : theme.primaryText },
                selected && { fontWeight: "700" },
              ]}
            >
              {title}
            </Text>
            {description ? (
              <Text
                style={[
                  styles.choiceCardDescription,
                  { color: theme.secondaryText },
                ]}
              >
                {description}
              </Text>
            ) : null}
          </View>
          {badge ? (
            <View
              style={[
                styles.choiceCardBadge,
                { backgroundColor: theme.blushSurface },
              ]}
            >
              <Text
                style={[
                  styles.choiceCardBadgeText,
                  { color: theme.primaryAccent },
                ]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------
   Styles (Layout, Spacing, Radii, Typography)
   -------------------------------------------------- */
const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
    alignSelf: "center",
  },

  /* Header */
  headerContainer: {
    paddingHorizontal: tokens.spacing.page,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.xs,
  },
  headerBackBtn: {
    alignSelf: "flex-start",
    paddingVertical: tokens.spacing.xs,
    paddingRight: tokens.spacing.sm,
  },
  headerBackBtnPressed: {
    opacity: 0.7,
  },
  headerBackText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
  },
  headerRightSlot: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: tokens.typeScale.screenTitle,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: tokens.typeScale.body,
    lineHeight: 20,
    marginTop: 2,
  },

  /* Section Card */
  cardBase: {
    borderRadius: tokens.radii.card,
    borderWidth: 1.2,
    padding: tokens.spacing.lg,
    marginHorizontal: tokens.spacing.page,
    marginBottom: tokens.spacing.md,
  },

  /* Primary Button */
  primaryButton: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
  },

  /* Quiet Button */
  quietButtonSoft: {
    borderWidth: 1.2,
    paddingVertical: tokens.spacing.sm + 2,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  quietButtonText: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  quietButtonDisabled: {
    opacity: 0.5,
  },
  quietButtonSoftText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
  },
  quietButtonPlainText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
  },

  /* Status Pill */
  pillBase: {
    borderRadius: tokens.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillBaseText: {
    fontSize: tokens.typeScale.overline + 0.5,
    fontWeight: "600",
  },

  /* Empty State */
  emptyContainer: {
    borderRadius: tokens.radii.large,
    borderWidth: 1.2,
    padding: tokens.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: tokens.spacing.page,
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  emptyTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: tokens.typeScale.body,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  emptyActionRow: {
    marginTop: tokens.spacing.sm,
  },

  /* Choice Card */
  choiceCard: {
    borderRadius: tokens.radii.card,
    borderWidth: 1.2,
    padding: tokens.spacing.md,
  },
  choiceCardDisabled: {
    opacity: 0.5,
  },
  choiceCardContent: {
    width: "100%",
  },
  choiceCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  choiceCardIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  choiceCardTextCol: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 3,
  },
  choiceCardTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
  },
  choiceCardDescription: {
    fontSize: tokens.typeScale.caption,
    lineHeight: 18,
  },
  choiceCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
    alignSelf: "flex-start",
    flexShrink: 0,
    marginLeft: 4,
  },
  choiceCardBadgeText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "600",
  },
});
