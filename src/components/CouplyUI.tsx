import { tokens } from "@/components/couply-tokens";
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
  const Container = safe ? SafeAreaView : View;
  return (
    <Container style={[styles.pageWrapper, style]}>
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
}

export function CouplyHeader({
  overline,
  title,
  subtitle,
  onBack,
  backLabel = "‹ Back",
  rightSlot,
  style,
}: CouplyHeaderProps) {
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
            <Text style={styles.headerBackText}>{backLabel}</Text>
          </Pressable>
          {rightSlot && <View style={styles.headerRightSlot}>{rightSlot}</View>}
        </View>
      )}

      {overline ? <Text style={styles.headerOverline}>{overline}</Text> : null}
      <View style={styles.headerTitleRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!onBack && rightSlot ? (
          <View style={styles.headerRightSlot}>{rightSlot}</View>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
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
  const variantStyle =
    variant === "lilac"
      ? styles.cardLilac
      : variant === "blush"
        ? styles.cardBlush
        : variant === "muted"
          ? styles.cardMuted
          : styles.cardDefault;

  return (
    <View
      style={[styles.cardBase, variantStyle, style]}
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
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !isDisabled && styles.primaryButtonPressed,
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
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={[styles.primaryButtonText, textStyle]}>{label}</Text>
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
  const isSoft = variant === "soft";

  return (
    <Pressable
      style={({ pressed }) => [
        isSoft ? styles.quietButtonSoft : styles.quietButtonText,
        pressed &&
          !disabled &&
          (isSoft ? styles.quietButtonSoftPressed : styles.quietButtonTextPressed),
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
          isSoft ? styles.quietButtonSoftText : styles.quietButtonPlainText,
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
  | "reconnected"
  | "positive"
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
  const pillStyle =
    variant === "open"
      ? styles.pillOpen
      : variant === "softening"
        ? styles.pillSoftening
        : variant === "reconnected"
          ? styles.pillReconnected
          : variant === "positive"
            ? styles.pillPositive
            : variant === "preview"
              ? styles.pillPreview
              : styles.pillNeutral;

  const pillTextStyle =
    variant === "open"
      ? styles.pillOpenText
      : variant === "softening"
        ? styles.pillSofteningText
        : variant === "reconnected"
          ? styles.pillReconnectedText
          : variant === "positive"
            ? styles.pillPositiveText
            : variant === "preview"
              ? styles.pillPreviewText
              : styles.pillNeutralText;

  return (
    <View style={[styles.pillBase, pillStyle, style]}>
      <Text style={[styles.pillBaseText, pillTextStyle, textStyle]}>
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
  return (
    <View style={[styles.emptyContainer, style]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed &&
          !disabled &&
          (selected
            ? styles.choiceCardSelectedPressed
            : styles.choiceCardPressed),
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
                selected && styles.choiceCardTitleSelected,
              ]}
            >
              {title}
            </Text>
            {description ? (
              <Text
                style={[
                  styles.choiceCardDescription,
                  selected && styles.choiceCardDescriptionSelected,
                ]}
              >
                {description}
              </Text>
            ) : null}
          </View>
          {badge ? (
            <View style={styles.choiceCardBadge}>
              <Text style={styles.choiceCardBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------
   Styles
   -------------------------------------------------- */
const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: tokens.colors.pageBackground,
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
    color: tokens.colors.plum,
  },
  headerRightSlot: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tokens.colors.plum,
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
    color: tokens.colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
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
  cardDefault: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
  },
  cardLilac: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderColor: tokens.colors.borderSoft,
  },
  cardBlush: {
    backgroundColor: tokens.colors.surfaceBlush,
    borderColor: tokens.colors.borderSoft,
  },
  cardMuted: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
  },

  /* Primary Button */
  primaryButton: {
    backgroundColor: tokens.colors.plum,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    backgroundColor: tokens.colors.plumPressed,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
  },

  /* Quiet Button */
  quietButtonSoft: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.sm + 2,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  quietButtonSoftPressed: {
    backgroundColor: tokens.colors.borderSoft,
    borderColor: tokens.colors.plum,
  },
  quietButtonText: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  quietButtonTextPressed: {
    opacity: 0.7,
  },
  quietButtonDisabled: {
    opacity: 0.5,
  },
  quietButtonSoftText: {
    color: tokens.colors.plum,
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
  },
  quietButtonPlainText: {
    color: tokens.colors.textSecondary,
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
  pillNeutral: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
  },
  pillNeutralText: {
    color: tokens.colors.textSecondary,
  },
  pillOpen: {
    backgroundColor: tokens.colors.openSoft,
    borderColor: tokens.colors.openBorder,
  },
  pillOpenText: {
    color: tokens.colors.openText,
  },
  pillSoftening: {
    backgroundColor: tokens.colors.softeningSoft,
    borderColor: tokens.colors.softeningBorder,
  },
  pillSofteningText: {
    color: tokens.colors.softeningText,
  },
  pillReconnected: {
    backgroundColor: tokens.colors.reconnectedSoft,
    borderColor: tokens.colors.reconnectedBorder,
  },
  pillReconnectedText: {
    color: tokens.colors.reconnectedText,
  },
  pillPositive: {
    backgroundColor: tokens.colors.celebrationSoft,
    borderColor: tokens.colors.celebrationBorder,
  },
  pillPositiveText: {
    color: tokens.colors.celebrationText,
  },
  pillPreview: {
    backgroundColor: tokens.colors.previewSoft,
    borderColor: tokens.colors.previewBorder,
  },
  pillPreviewText: {
    color: tokens.colors.previewText,
  },

  /* Empty State */
  emptyContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.large,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  emptyActionRow: {
    marginTop: tokens.spacing.sm,
  },

  /* Choice Card */
  choiceCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  choiceCardSelected: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderColor: tokens.colors.plum,
    borderWidth: 1.5,
  },
  choiceCardPressed: {
    backgroundColor: tokens.colors.surfaceLilac,
  },
  choiceCardSelectedPressed: {
    backgroundColor: tokens.colors.borderSoft,
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
    color: tokens.colors.text,
  },
  choiceCardTitleSelected: {
    color: tokens.colors.plum,
    fontWeight: "700",
  },
  choiceCardDescription: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  choiceCardDescriptionSelected: {
    color: tokens.colors.text,
  },
  choiceCardBadge: {
    backgroundColor: tokens.colors.surfaceBlush,
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
    color: tokens.colors.plum,
  },
});
