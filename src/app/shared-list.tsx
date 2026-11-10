import { AppBottomNav } from "@/components/AppBottomNav";
import { tokens } from "@/components/couply-tokens";
import {
  CouplyEmptyState,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type TaskCategory = "groceries" | "home" | "errands" | "other";
export type TaskStatus = "open" | "completed";

export interface CoupleTask {
  id: string;
  couple_id: string;
  created_by: string | null;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CategoryFilter = "all" | TaskCategory;

export interface QuickStartTemplateItem {
  title: string;
  category: TaskCategory;
}

export interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  items: QuickStartTemplateItem[];
}

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "grocery-run",
    name: "Grocery run",
    description: "A simple starting point for the next shop.",
    items: [
      { title: "Fruit and vegetables", category: "groceries" },
      { title: "Bread or breakfast basics", category: "groceries" },
      { title: "Milk or preferred alternative", category: "groceries" },
      { title: "Household essentials", category: "groceries" },
    ],
  },
  {
    id: "home-reset",
    name: "Home reset",
    description: "A few everyday things that help the home feel lighter.",
    items: [
      { title: "Kitchen and dishes", category: "home" },
      { title: "Laundry", category: "home" },
      { title: "Bins and recycling", category: "home" },
      { title: "Tidy shared spaces", category: "home" },
    ],
  },
  {
    id: "errands",
    name: "Errands",
    description: "Keep the little stops in one shared place.",
    items: [
      { title: "Pick-ups", category: "errands" },
      { title: "Returns or post", category: "errands" },
      { title: "Pharmacy or health items", category: "errands" },
      { title: "Other stops", category: "errands" },
    ],
  },
  {
    id: "weekend-preparation",
    name: "Weekend preparation",
    description: "A gentle overview of the weekend ahead.",
    items: [
      { title: "Meals and groceries", category: "groceries" },
      { title: "Appointments", category: "other" },
      { title: "Household admin", category: "home" },
      { title: "Time together", category: "other" },
    ],
  },
];

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "groceries", label: "Groceries" },
  { key: "home", label: "Home" },
  { key: "errands", label: "Errands" },
  { key: "other", label: "Other" },
];

const CATEGORY_CHOICES: { key: TaskCategory; label: string }[] = [
  { key: "groceries", label: "Groceries" },
  { key: "home", label: "Home" },
  { key: "errands", label: "Errands" },
  { key: "other", label: "Other" },
];

export function getCategoryAdjective(category: TaskCategory): string {
  switch (category) {
    case "groceries":
      return "Grocery";
    case "home":
      return "Home";
    case "errands":
      return "Errand";
    case "other":
      return "Other";
    default:
      return "Other";
  }
}

export function getCategoryLabel(category: CategoryFilter): string {
  switch (category) {
    case "all":
      return "All";
    case "groceries":
      return "Groceries";
    case "home":
      return "Home";
    case "errands":
      return "Errands";
    case "other":
      return "Other";
    default:
      return "All";
  }
}

export default function SharedListScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { userId, coupleId, partnerConnected, isLoading: isIdentityLoading } =
    useUserIdentity();

  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  // Add / Edit Modal state
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CoupleTask | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<TaskCategory>("other");
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [taskToDelete, setTaskToDelete] = useState<CoupleTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Start Picker & Review Modal state
  const [isQuickStartModalVisible, setIsQuickStartModalVisible] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<QuickStartTemplate | null>(null);
  const [templateReviewItems, setTemplateReviewItems] = useState<
    { id: string; title: string; category: TaskCategory; selected: boolean }[]
  >([]);
  const [isQuickStartSubmitting, setIsQuickStartSubmitting] = useState(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);

  // Category bulk actions state
  const [isCategoryMenuVisible, setIsCategoryMenuVisible] = useState(false);
  const [isClearCompletedConfirmVisible, setIsClearCompletedConfirmVisible] =
    useState(false);
  const [isRemoveAllConfirmVisible, setIsRemoveAllConfirmVisible] =
    useState(false);
  const [isBulkActionSubmitting, setIsBulkActionSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "notice" | "error";
  } | null>(null);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback(
    (text: string, type: "success" | "notice" | "error" = "success") => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      setFeedbackMessage({ text, type });
      if (type !== "error") {
        feedbackTimerRef.current = setTimeout(() => {
          setFeedbackMessage(null);
        }, 4500);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleCategoryTabPress = useCallback((tabKey: CategoryFilter) => {
    setActiveCategory(tabKey);
    setIsCategoryMenuVisible(false);
    setIsClearCompletedConfirmVisible(false);
    setIsRemoveAllConfirmVisible(false);
  }, []);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/events?scope=ours");
    }
  }, [router]);

  // Load tasks query
  const loadTasks = useCallback(
    async (currentCoupleId: string, showSpinner = false) => {
      if (showSpinner) {
        setIsTasksLoading(true);
      }
      try {
        const { data, error } = await supabase
          .from("couple_tasks")
          .select(
            "id, couple_id, created_by, title, category, status, completed_at, created_at, updated_at"
          )
          .eq("couple_id", currentCoupleId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error loading shared tasks:", error);
          return;
        }

        setTasks((data as CoupleTask[]) || []);
      } catch (err) {
        console.error("Failed to load shared tasks:", err);
      } finally {
        if (showSpinner) {
          setIsTasksLoading(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      if (coupleId) {
        void loadTasks(coupleId, tasks.length === 0);
      }
    }, [coupleId, loadTasks, tasks.length])
  );

  // Realtime subscription setup
  useEffect(() => {
    if (!coupleId) {
      return;
    }

    const channelName = `couple-tasks-${coupleId}`;
    let isDisposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const startRealtime = async () => {
      // 1. Remove duplicate channel on hot reload
      const existingChannel = supabase
        .getChannels()
        .find((candidate) => candidate.topic === `realtime:${channelName}`);

      if (existingChannel) {
        await supabase.removeChannel(existingChannel);
      }

      if (isDisposed) {
        return;
      }

      // 2. Subscribe to postgres_changes with 150ms debounce
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "couple_tasks",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              if (!isDisposed) {
                void loadTasks(coupleId, false);
              }
            }, 150);
          }
        )
        .subscribe();
    };

    void startRealtime();

    return () => {
      isDisposed = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [coupleId, loadTasks]);

  // Derived task lists
  const openTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "open")
      .filter((task) =>
        activeCategory === "all" ? true : task.category === activeCategory
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [tasks, activeCategory]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "completed")
      .filter((task) =>
        activeCategory === "all" ? true : task.category === activeCategory
      )
      .sort((a, b) => {
        const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [tasks, activeCategory]);

  const totalOpenCount = useMemo(() => {
    return tasks.filter((t) => t.status === "open").length;
  }, [tasks]);

  // Category-specific statistics for active category
  const categoryStats = useMemo(() => {
    if (activeCategory === "all") {
      const openCount = tasks.filter((t) => t.status === "open").length;
      const completedCount = tasks.filter(
        (t) => t.status === "completed"
      ).length;
      return {
        openCount,
        completedCount,
        totalCount: openCount + completedCount,
      };
    }
    const matching = tasks.filter((t) => t.category === activeCategory);
    const openCount = matching.filter((t) => t.status === "open").length;
    const completedCount = matching.filter(
      (t) => t.status === "completed"
    ).length;
    return {
      openCount,
      completedCount,
      totalCount: matching.length,
    };
  }, [tasks, activeCategory]);

  // Add & Edit actions
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormCategory("other");
    setFormError(null);
    setIsFormModalVisible(true);
  };

  const handleOpenEditModal = (task: CoupleTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormCategory(task.category);
    setFormError(null);
    setIsFormModalVisible(true);
  };

  const handleSaveForm = async () => {
    const cleanTitle = formTitle.trim();
    if (!cleanTitle || cleanTitle.length > 120 || !coupleId) {
      return;
    }

    setIsFormSubmitting(true);
    setFormError(null);

    try {
      if (editingTask) {
        // Edit only title and category
        const { data, error } = await supabase
          .from("couple_tasks")
          .update({
            title: cleanTitle,
            category: formCategory,
          })
          .eq("id", editingTask.id)
          .select();

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          setFormError("This item is no longer on the shared list.");
          return;
        }
      } else {
        // Add new item
        const { error } = await supabase.from("couple_tasks").insert({
          couple_id: coupleId,
          title: cleanTitle,
          category: formCategory,
        });

        if (error) {
          throw error;
        }
      }

      setIsFormModalVisible(false);
      void loadTasks(coupleId, false);
    } catch (err: any) {
      console.error("Failed to save task:", err);
      setFormError(err.message || "Unable to save item. Please try again.");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Completion toggle actions
  const handleToggleComplete = async (task: CoupleTask) => {
    if (!coupleId) return;

    if (task.status === "open") {
      const now = new Date().toISOString();
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "completed", completed_at: now } : t
        )
      );

      const { error } = await supabase
        .from("couple_tasks")
        .update({
          status: "completed",
          completed_at: now,
        })
        .eq("id", task.id);

      if (error) {
        console.error("Failed to complete task:", error);
        void loadTasks(coupleId, false);
      }
    } else {
      // Reopen item
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "open", completed_at: null } : t
        )
      );

      const { error } = await supabase
        .from("couple_tasks")
        .update({
          status: "open",
          completed_at: null,
        })
        .eq("id", task.id);

      if (error) {
        console.error("Failed to reopen task:", error);
        void loadTasks(coupleId, false);
      }
    }
  };

  // Delete actions
  const handleConfirmDelete = async () => {
    if (!taskToDelete || !coupleId) return;

    setIsDeleting(true);
    try {
      // Optimistic removal
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));

      const { error } = await supabase
        .from("couple_tasks")
        .delete()
        .eq("id", taskToDelete.id);

      if (error) {
        throw error;
      }

      setTaskToDelete(null);
    } catch (err) {
      console.error("Failed to delete task:", err);
      void loadTasks(coupleId, false);
      setTaskToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick Start picker & submission
  const handleOpenQuickStartPicker = () => {
    setActiveTemplate(null);
    setTemplateReviewItems([]);
    setQuickStartError(null);
    setIsQuickStartModalVisible(true);
  };

  const handleSelectTemplate = (template: QuickStartTemplate) => {
    setActiveTemplate(template);
    setTemplateReviewItems(
      template.items.map((item, index) => ({
        id: `template-item-${index}-${Date.now()}`,
        title: item.title,
        category: item.category,
        selected: true,
      }))
    );
    setQuickStartError(null);
  };

  const handleToggleTemplateItem = (itemId: string) => {
    setTemplateReviewItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdateTemplateItemTitle = (itemId: string, text: string) => {
    setTemplateReviewItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, title: text.slice(0, 120) } : item
      )
    );
  };

  const handleAddTemplateItemRow = () => {
    const category = activeTemplate?.items[0]?.category || "other";
    setTemplateReviewItems((prev) => [
      ...prev,
      {
        id: `template-custom-${Date.now()}`,
        title: "",
        category,
        selected: true,
      },
    ]);
  };

  const selectedTemplateItems = useMemo(() => {
    return templateReviewItems.filter(
      (item) => item.selected && item.title.trim().length > 0
    );
  }, [templateReviewItems]);

  const handleBulkInsertTemplate = async () => {
    if (!coupleId || selectedTemplateItems.length === 0) return;

    setIsQuickStartSubmitting(true);
    setQuickStartError(null);

    try {
      const rows = selectedTemplateItems.map((item) => ({
        couple_id: coupleId,
        title: item.title.trim(),
        category: item.category,
      }));

      const { error } = await supabase.from("couple_tasks").insert(rows);

      if (error) {
        throw error;
      }

      setIsQuickStartModalVisible(false);
      setActiveTemplate(null);
      void loadTasks(coupleId, false);
    } catch (err: any) {
      console.error("Failed to insert quick start template items:", err);
      setQuickStartError(
        err.message || "Failed to add items from template. Please try again."
      );
    } finally {
      setIsQuickStartSubmitting(false);
    }
  };

  // Bulk Actions
  const handleExecuteMarkAllComplete = async () => {
    if (!coupleId || activeCategory === "all" || isBulkActionSubmitting) return;

    setIsCategoryMenuVisible(false);
    setIsBulkActionSubmitting(true);
    const adjective = getCategoryAdjective(activeCategory);
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from("couple_tasks")
        .update({
          status: "completed",
          completed_at: now,
        })
        .eq("couple_id", coupleId)
        .eq("category", activeCategory)
        .eq("status", "open")
        .select("id");

      if (error) {
        console.error("Failed to mark all items complete:", error);
        showFeedback(
          "Unable to update items right now. Please try again.",
          "error"
        );
        return;
      }

      if (!data || data.length === 0) {
        showFeedback(
          `All open ${adjective} items are already complete.`,
          "notice"
        );
      } else {
        showFeedback(
          `All open ${adjective} items are now complete.`,
          "success"
        );
      }

      await loadTasks(coupleId, false);
    } catch (err) {
      console.error("Failed to mark all items complete:", err);
      showFeedback(
        "Unable to update items right now. Please try again.",
        "error"
      );
    } finally {
      setIsBulkActionSubmitting(false);
    }
  };

  const handleOpenClearCompletedConfirm = () => {
    setIsCategoryMenuVisible(false);
    setIsClearCompletedConfirmVisible(true);
  };

  const handleExecuteClearCompleted = async () => {
    if (!coupleId || activeCategory === "all" || isBulkActionSubmitting) return;

    setIsBulkActionSubmitting(true);
    const adjective = getCategoryAdjective(activeCategory);

    try {
      const { data, error } = await supabase
        .from("couple_tasks")
        .delete()
        .eq("couple_id", coupleId)
        .eq("category", activeCategory)
        .eq("status", "completed")
        .select("id");

      if (error) {
        console.error("Failed to clear completed items:", error);
        showFeedback(
          "Unable to clear completed items right now. Please try again.",
          "error"
        );
        return;
      }

      setIsClearCompletedConfirmVisible(false);

      if (!data || data.length === 0) {
        showFeedback(
          `Completed ${adjective} items were already cleared.`,
          "notice"
        );
      } else {
        showFeedback(
          `Completed ${adjective} items have been cleared.`,
          "success"
        );
      }

      await loadTasks(coupleId, false);
    } catch (err) {
      console.error("Failed to clear completed items:", err);
      showFeedback(
        "Unable to clear completed items right now. Please try again.",
        "error"
      );
    } finally {
      setIsBulkActionSubmitting(false);
    }
  };

  const handleOpenRemoveAllConfirm = () => {
    setIsCategoryMenuVisible(false);
    setIsRemoveAllConfirmVisible(true);
  };

  const handleExecuteRemoveAll = async () => {
    if (!coupleId || activeCategory === "all" || isBulkActionSubmitting) return;

    setIsBulkActionSubmitting(true);
    const adjective = getCategoryAdjective(activeCategory);

    try {
      const { data, error } = await supabase
        .from("couple_tasks")
        .delete()
        .eq("couple_id", coupleId)
        .eq("category", activeCategory)
        .select("id");

      if (error) {
        console.error("Failed to remove all category items:", error);
        showFeedback(
          "Unable to remove items right now. Please try again.",
          "error"
        );
        return;
      }

      setIsRemoveAllConfirmVisible(false);

      if (!data || data.length === 0) {
        showFeedback(`${adjective} items were already removed.`, "notice");
      } else {
        showFeedback(
          `All ${adjective} items have been removed.`,
          "success"
        );
      }

      await loadTasks(coupleId, false);
    } catch (err) {
      console.error("Failed to remove all category items:", err);
      showFeedback(
        "Unable to remove items right now. Please try again.",
        "error"
      );
    } finally {
      setIsBulkActionSubmitting(false);
    }
  };

  // State 1: Identity loading
  if (isIdentityLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CouplyHeader
          title="Shared list"
          subtitle="Groceries, home tasks and little things you’re handling together."
          onBack={handleBack}
          backLabel="‹ Our Space"
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Restoring your shared list...</Text>
          <View style={styles.skeletonCard} />
          <View style={[styles.skeletonCard, { opacity: 0.6 }]} />
        </View>
      </SafeAreaView>
    );
  }

  // State 2: No authenticated user
  if (!userId) {
    router.replace("/");
    return null;
  }

  // State 3: No connected partner
  if (!partnerConnected || !coupleId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CouplyHeader
          title="Shared list"
          subtitle="Groceries, home tasks and little things you’re handling together."
          onBack={handleBack}
          backLabel="‹ Our Space"
        />
        <View style={styles.mainColumn}>
          <CouplyEmptyState
            title="Connect your space first"
            body="A shared list becomes available when both of you are connected."
            action={
              <CouplyPrimaryButton
                label="Manage relationship space"
                onPress={() => router.push("/profile")}
                accessibilityLabel="Manage relationship space"
              />
            }
          />
        </View>
        <AppBottomNav activeTab="our_space" />
      </SafeAreaView>
    );
  }

  const isEmpty = tasks.length === 0 && !isTasksLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainColumn}>
          {/* Header */}
          <CouplyHeader
            title="Shared list"
            subtitle="Groceries, home tasks and little things you’re handling together."
            onBack={handleBack}
            backLabel="‹ Our Space"
            rightSlot={
              !isEmpty ? (
                <CouplyPrimaryButton
                  label="+ Add item"
                  onPress={handleOpenAddModal}
                  accessibilityLabel="Add an item"
                  style={styles.headerAddBtn}
                  textStyle={styles.headerAddBtnText}
                />
              ) : null
            }
          />

          {/* Quiet open count indicator */}
          {!isEmpty && (
            <View style={styles.openCountRow}>
              <Text style={styles.openCountText}>
                {totalOpenCount === 0
                  ? "All items completed"
                  : `${totalOpenCount} open item${totalOpenCount === 1 ? "" : "s"}`}
              </Text>
              <Pressable
                onPress={handleOpenQuickStartPicker}
                style={({ pressed }) => [
                  styles.quickStartPillBtn,
                  pressed && styles.pressedState,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose a Quick Start template"
              >
                <Text style={styles.quickStartPillBtnText}>+ Quick Start</Text>
              </Pressable>
            </View>
          )}

          {/* Category Filter Chips */}
          {!isEmpty && (
            <View style={styles.categoryChipsRow} role="tablist">
              {CATEGORY_TABS.map((tab) => {
                const isSelected = activeCategory === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => handleCategoryTabPress(tab.key)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipActive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filter by ${tab.label}`}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Helper line when "All" is active */}
          {!isEmpty && activeCategory === "all" && (
            <View style={styles.allCategoryHelperRow}>
              <Text style={styles.allCategoryHelperText}>
                Choose a category to manage several items together.
              </Text>
            </View>
          )}

          {/* Category Management Row (shown when a specific category is selected) */}
          {!isEmpty && activeCategory !== "all" && (
            <View style={styles.categoryBar}>
              <View style={styles.categoryBarTextCol}>
                <Text style={styles.categoryBarTitle}>
                  {getCategoryLabel(activeCategory)} · {categoryStats.totalCount}{" "}
                  {categoryStats.totalCount === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.categoryBarSubtitle}>
                  {categoryStats.totalCount === 0
                    ? `No ${getCategoryAdjective(activeCategory).toLowerCase()} items to manage yet.`
                    : `${categoryStats.openCount} open · ${categoryStats.completedCount} completed`}
                </Text>
              </View>

              {categoryStats.totalCount > 0 && (
                <Pressable
                  onPress={() => setIsCategoryMenuVisible(true)}
                  disabled={isBulkActionSubmitting}
                  style={({ pressed }) => [
                    styles.manageCategoryBtn,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${getCategoryLabel(
                    activeCategory
                  )} category`}
                  accessibilityState={{ expanded: isCategoryMenuVisible }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.manageCategoryBtnText}>
                    Manage category
                  </Text>
                  <Text style={styles.manageCategoryBtnChevron}>▾</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Calm Feedback Banner */}
          {feedbackMessage && (
            <View
              style={[
                styles.feedbackBanner,
                feedbackMessage.type === "error"
                  ? styles.feedbackBannerError
                  : feedbackMessage.type === "notice"
                  ? styles.feedbackBannerNotice
                  : styles.feedbackBannerSuccess,
              ]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text
                style={[
                  styles.feedbackBannerText,
                  feedbackMessage.type === "error"
                    ? styles.feedbackBannerTextError
                    : feedbackMessage.type === "notice"
                    ? styles.feedbackBannerTextNotice
                    : styles.feedbackBannerTextSuccess,
                ]}
              >
                {feedbackMessage.text}
              </Text>
              <Pressable
                onPress={() => setFeedbackMessage(null)}
                style={styles.feedbackDismissBtn}
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.feedbackDismissText}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* State 4: Empty List */}
          {isEmpty && (
            <View style={styles.emptyWrap}>
              <CouplyEmptyState
                title="Your shared list is ready"
                body="Add one small thing or begin with a Quick Start."
                action={
                  <View style={styles.emptyActionsCol}>
                    <CouplyPrimaryButton
                      label="Add an item"
                      onPress={handleOpenAddModal}
                      accessibilityLabel="Add an item"
                      style={styles.emptyActionBtn}
                    />
                    <CouplyQuietButton
                      label="Choose a Quick Start"
                      onPress={handleOpenQuickStartPicker}
                      accessibilityLabel="Choose a Quick Start"
                      style={styles.emptyActionBtn}
                    />
                  </View>
                }
              />
            </View>
          )}

          {/* State 5: Populated List */}
          {!isEmpty && (
            <View style={styles.listSection}>
              {/* Open Items Section */}
              {openTasks.length === 0 ? (
                <View style={styles.quietPlaceholder}>
                  <Text style={styles.quietPlaceholderText}>
                    {activeCategory === "all"
                      ? "No open items right now."
                      : categoryStats.totalCount === 0
                      ? `No ${getCategoryAdjective(
                          activeCategory
                        ).toLowerCase()} items to manage yet.`
                      : `No open items in ${getCategoryLabel(
                          activeCategory
                        ).toLowerCase()}.`}
                  </Text>
                </View>
              ) : (
                openTasks.map((task) => (
                  <View key={task.id} style={styles.taskCard}>
                    {/* Checkbox */}
                    <Pressable
                      onPress={() => handleToggleComplete(task)}
                      style={styles.checkboxTouch}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel={`Mark "${task.title}" as completed`}
                    >
                      <View style={styles.checkboxCircle} />
                    </Pressable>

                    {/* Content */}
                    <Pressable
                      onPress={() => handleOpenEditModal(task)}
                      style={styles.taskTextCol}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit item: ${task.title}`}
                    >
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <View style={styles.taskMetaRow}>
                        <CouplyStatusPill
                          label={capitalize(task.category)}
                          variant="neutral"
                        />
                      </View>
                    </Pressable>

                    {/* Action buttons */}
                    <View style={styles.taskActionsRow}>
                      <Pressable
                        onPress={() => handleOpenEditModal(task)}
                        style={({ pressed }) => [
                          styles.iconActionBtn,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit "${task.title}"`}
                      >
                        <Text style={styles.editActionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setTaskToDelete(task)}
                        style={({ pressed }) => [
                          styles.iconActionBtn,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete "${task.title}"`}
                      >
                        <Text style={styles.deleteActionText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              {/* Completed Items Section (Collapsible) */}
              {completedTasks.length > 0 && (
                <View style={styles.completedSection}>
                  <Pressable
                    onPress={() => setIsCompletedExpanded((prev) => !prev)}
                    style={styles.completedHeaderToggle}
                    accessibilityRole="button"
                    accessibilityLabel={`Completed items, ${completedTasks.length} items, ${
                      isCompletedExpanded ? "expanded" : "collapsed"
                    }`}
                  >
                    <Text style={styles.completedHeaderTitle}>
                      Completed ({completedTasks.length})
                    </Text>
                    <Text style={styles.completedHeaderChevron}>
                      {isCompletedExpanded ? "▴" : "▾"}
                    </Text>
                  </Pressable>

                  {isCompletedExpanded &&
                    completedTasks.map((task) => (
                      <View
                        key={task.id}
                        style={[styles.taskCard, styles.completedTaskCard]}
                      >
                        {/* Checkbox (checked) */}
                        <Pressable
                          onPress={() => handleToggleComplete(task)}
                          style={styles.checkboxTouch}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: true }}
                          accessibilityLabel={`Reopen "${task.title}"`}
                        >
                          <View
                            style={[
                              styles.checkboxCircle,
                              styles.checkboxCircleChecked,
                            ]}
                          >
                            <Text style={styles.checkGlyph}>✓</Text>
                          </View>
                        </Pressable>

                        {/* Content */}
                        <View style={styles.taskTextCol}>
                          <Text
                            style={[
                              styles.taskTitle,
                              styles.completedTaskTitle,
                            ]}
                          >
                            {task.title}
                          </Text>
                          <View style={styles.taskMetaRow}>
                            <CouplyStatusPill
                              label="Done"
                              variant="reconnected"
                            />
                            <CouplyStatusPill
                              label={capitalize(task.category)}
                              variant="neutral"
                            />
                          </View>
                        </View>

                        {/* Action buttons */}
                        <View style={styles.taskActionsRow}>
                          <Pressable
                            onPress={() => handleToggleComplete(task)}
                            style={({ pressed }) => [
                              styles.iconActionBtn,
                              pressed && styles.pressedState,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Reopen "${task.title}"`}
                          >
                            <Text style={styles.reopenActionText}>Reopen</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setTaskToDelete(task)}
                            style={({ pressed }) => [
                              styles.iconActionBtn,
                              pressed && styles.pressedState,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete "${task.title}"`}
                          >
                            <Text style={styles.deleteActionText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add / Edit Item Modal */}
      <Modal
        visible={isFormModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFormModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingTask ? "Edit item" : "Add an item"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {editingTask
                  ? "Update title or category on your shared list."
                  : "Add groceries, errands, or tasks to share."}
              </Text>

              {formError && (
                <View
                  style={styles.modalErrorBanner}
                  accessibilityRole="alert"
                >
                  <Text style={styles.modalErrorBannerText}>{formError}</Text>
                </View>
              )}

              {/* Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="e.g. Oat milk, Post office, Dishwasher..."
                  placeholderTextColor={theme.mutedText}
                  maxLength={120}
                  autoFocus
                  style={styles.textInput}
                  accessibilityLabel="Item title"
                />
                <Text style={styles.charCounter}>
                  {formTitle.length}/120
                </Text>
              </View>

              {/* Category Choice */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categoryRadioRow} role="radiogroup">
                  {CATEGORY_CHOICES.map((choice) => {
                    const isSelected = formCategory === choice.key;
                    return (
                      <Pressable
                        key={choice.key}
                        onPress={() => setFormCategory(choice.key)}
                        style={[
                          styles.categoryRadioBtn,
                          isSelected && styles.categoryRadioBtnActive,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Category: ${choice.label}`}
                      >
                        <Text
                          style={[
                            styles.categoryRadioBtnText,
                            isSelected && styles.categoryRadioBtnTextActive,
                          ]}
                        >
                          {choice.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActionsRow}>
                <CouplyQuietButton
                  label="Cancel"
                  onPress={() => setIsFormModalVisible(false)}
                  accessibilityLabel="Cancel"
                  style={styles.modalCancelBtn}
                />
                <CouplyPrimaryButton
                  label={editingTask ? "Save changes" : "Add to shared list"}
                  onPress={handleSaveForm}
                  disabled={formTitle.trim().length === 0 || isFormSubmitting}
                  loading={isFormSubmitting}
                  accessibilityLabel={
                    editingTask ? "Save changes" : "Add to shared list"
                  }
                  style={styles.modalSubmitBtn}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(taskToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Remove this item?</Text>
              <Text style={styles.modalSubtitle}>
                It will disappear from the shared list for both of you.
              </Text>

              <View style={styles.deleteConfirmDetailsBox}>
                <Text style={styles.deleteConfirmTitle}>
                  {taskToDelete?.title}
                </Text>
                <Text style={styles.deleteConfirmCategory}>
                  Category: {capitalize(taskToDelete?.category || "other")}
                </Text>
              </View>

              <View style={styles.modalActionsRow}>
                <CouplyQuietButton
                  label="Keep it"
                  onPress={() => setTaskToDelete(null)}
                  accessibilityLabel="Keep it"
                  style={styles.modalCancelBtn}
                />
                <CouplyPrimaryButton
                  label="Remove item"
                  onPress={handleConfirmDelete}
                  loading={isDeleting}
                  accessibilityLabel="Remove item"
                  style={[
                    styles.modalSubmitBtn,
                    { backgroundColor: theme.status.error.bg, borderColor: theme.status.error.border },
                  ]}
                  textStyle={{ color: theme.status.error.text }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Quick Start Picker & Review Modal */}
      <Modal
        visible={isQuickStartModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsQuickStartModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalCard, styles.quickStartModalCard]}>
              {!activeTemplate ? (
                // Step 1: Template Selection
                <>
                  <Text style={styles.modalTitle}>Choose a Quick Start</Text>
                  <Text style={styles.modalSubtitle}>
                    Select a thoughtful bundle of common items to review and add.
                  </Text>

                  <ScrollView
                    style={styles.templateListScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {QUICK_START_TEMPLATES.map((tmpl) => (
                      <Pressable
                        key={tmpl.id}
                        onPress={() => handleSelectTemplate(tmpl)}
                        style={({ pressed }) => [
                          styles.templateChoiceCard,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${tmpl.name}: ${tmpl.description}`}
                      >
                        <View style={styles.templateChoiceContent}>
                          <Text style={styles.templateChoiceName}>
                            {tmpl.name}
                          </Text>
                          <Text style={styles.templateChoiceDesc}>
                            {tmpl.description}
                          </Text>
                          <Text style={styles.templateChoiceCount}>
                            {tmpl.items.length} items suggested
                          </Text>
                        </View>
                        <Text style={styles.templateChoiceChevron}>›</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.modalActionsRow}>
                    <CouplyQuietButton
                      label="Cancel"
                      onPress={() => setIsQuickStartModalVisible(false)}
                      accessibilityLabel="Cancel"
                      style={styles.modalCancelBtn}
                    />
                  </View>
                </>
              ) : (
                // Step 2: Review and Edit Suggestions
                <>
                  <Text style={styles.modalTitle}>{activeTemplate.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    Deselect or edit wording before adding to your shared list.
                  </Text>

                  {quickStartError && (
                    <View
                      style={styles.modalErrorBanner}
                      accessibilityRole="alert"
                    >
                      <Text style={styles.modalErrorBannerText}>
                        {quickStartError}
                      </Text>
                    </View>
                  )}

                  <ScrollView
                    style={styles.templateReviewListScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {templateReviewItems.map((item) => (
                      <View key={item.id} style={styles.reviewItemRow}>
                        <Pressable
                          onPress={() => handleToggleTemplateItem(item.id)}
                          style={styles.checkboxTouch}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.selected }}
                          accessibilityLabel={
                            item.selected
                              ? `Deselect "${item.title}"`
                              : `Select "${item.title}"`
                          }
                        >
                          <View
                            style={[
                              styles.checkboxCircle,
                              item.selected && styles.checkboxCircleChecked,
                            ]}
                          >
                            {item.selected && (
                              <Text style={styles.checkGlyph}>✓</Text>
                            )}
                          </View>
                        </Pressable>

                        <TextInput
                          value={item.title}
                          onChangeText={(text) =>
                            handleUpdateTemplateItemTitle(item.id, text)
                          }
                          style={[
                            styles.reviewItemInput,
                            !item.selected && styles.reviewItemInputDeselected,
                          ]}
                          maxLength={120}
                          placeholder="Item title..."
                          placeholderTextColor={theme.mutedText}
                        />

                        <CouplyStatusPill
                          label={capitalize(item.category)}
                          variant="neutral"
                        />
                      </View>
                    ))}

                    <Pressable
                      onPress={handleAddTemplateItemRow}
                      style={styles.addTemplateRowBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Add another item to template"
                    >
                      <Text style={styles.addTemplateRowBtnText}>
                        + Add another item
                      </Text>
                    </Pressable>
                  </ScrollView>

                  <View style={styles.modalActionsRow}>
                    <CouplyQuietButton
                      label="Back"
                      onPress={() => setActiveTemplate(null)}
                      accessibilityLabel="Back to templates"
                      style={styles.modalCancelBtn}
                    />
                    <CouplyPrimaryButton
                      label={
                        selectedTemplateItems.length === 1
                          ? "Add 1 item"
                          : `Add ${selectedTemplateItems.length} items`
                      }
                      onPress={handleBulkInsertTemplate}
                      disabled={
                        selectedTemplateItems.length === 0 ||
                        isQuickStartSubmitting
                      }
                      loading={isQuickStartSubmitting}
                      accessibilityLabel={
                        selectedTemplateItems.length === 1
                          ? "Add 1 item"
                          : `Add ${selectedTemplateItems.length} items`
                      }
                      style={styles.modalSubmitBtn}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Actions Overflow Menu Modal */}
      <Modal
        visible={isCategoryMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsCategoryMenuVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss category actions"
        >
          <View
            style={[styles.modalCard, styles.menuCard]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.modalTitle}>
                {activeCategory !== "all"
                  ? `${getCategoryAdjective(activeCategory)} actions`
                  : "Category actions"}
              </Text>
              <Text style={styles.modalSubtitle}>
                Actions apply only to{" "}
                {activeCategory !== "all"
                  ? getCategoryAdjective(activeCategory).toLowerCase()
                  : ""}{" "}
                items on your shared list.
              </Text>
            </View>

            <View style={styles.menuItemsList}>
              {/* 1. Mark all complete */}
              {categoryStats.openCount > 0 && (
                <Pressable
                  onPress={handleExecuteMarkAllComplete}
                  disabled={isBulkActionSubmitting}
                  style={({ pressed }) => [
                    styles.menuItemRow,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all complete"
                >
                  <View style={styles.menuItemIconBox}>
                    <Text style={styles.menuItemIconGlyph}>✓</Text>
                  </View>
                  <View style={styles.menuItemTextCol}>
                    <Text style={styles.menuItemTitle}>Mark all complete</Text>
                    <Text style={styles.menuItemDescription}>
                      Complete {categoryStats.openCount} open{" "}
                      {categoryStats.openCount === 1 ? "item" : "items"}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* 2. Clear completed items */}
              {categoryStats.completedCount > 0 && (
                <Pressable
                  onPress={handleOpenClearCompletedConfirm}
                  disabled={isBulkActionSubmitting}
                  style={({ pressed }) => [
                    styles.menuItemRow,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear completed ${
                    activeCategory !== "all"
                      ? getCategoryAdjective(activeCategory)
                      : ""
                  } items`}
                >
                  <View style={styles.menuItemIconBox}>
                    <Text style={styles.menuItemIconGlyph}>🧹</Text>
                  </View>
                  <View style={styles.menuItemTextCol}>
                    <Text style={styles.menuItemTitle}>Clear completed</Text>
                    <Text style={styles.menuItemDescription}>
                      Remove {categoryStats.completedCount} completed{" "}
                      {categoryStats.completedCount === 1 ? "item" : "items"}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* 3. Remove all items in this category */}
              {categoryStats.totalCount > 0 && (
                <Pressable
                  onPress={handleOpenRemoveAllConfirm}
                  disabled={isBulkActionSubmitting}
                  style={({ pressed }) => [
                    styles.menuItemRow,
                    styles.menuItemRowDestructive,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove all ${
                    activeCategory !== "all"
                      ? getCategoryAdjective(activeCategory)
                      : ""
                  } items`}
                >
                  <View
                    style={[
                      styles.menuItemIconBox,
                      styles.menuItemIconBoxDestructive,
                    ]}
                  >
                    <Text style={styles.menuItemIconGlyphDestructive}>🗑</Text>
                  </View>
                  <View style={styles.menuItemTextCol}>
                    <Text
                      style={[
                        styles.menuItemTitle,
                        styles.menuItemTitleDestructive,
                      ]}
                    >
                      Remove all{" "}
                      {activeCategory !== "all"
                        ? getCategoryAdjective(activeCategory)
                        : ""}{" "}
                      items
                    </Text>
                    <Text style={styles.menuItemDescription}>
                      Remove all {categoryStats.totalCount}{" "}
                      {categoryStats.totalCount === 1 ? "item" : "items"} in
                      this category
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            <View style={styles.modalActionsRow}>
              <CouplyQuietButton
                label="Cancel"
                onPress={() => setIsCategoryMenuVisible(false)}
                accessibilityLabel="Cancel"
                style={styles.modalCancelBtn}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Clear Completed Confirmation Modal */}
      <Modal
        visible={isClearCompletedConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isBulkActionSubmitting) {
            setIsClearCompletedConfirmVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Clear completed{" "}
                {activeCategory !== "all"
                  ? getCategoryAdjective(activeCategory)
                  : ""}{" "}
                items?
              </Text>
              <Text style={styles.modalSubtitle}>
                {`This will remove ${categoryStats.completedCount} completed ${
                  categoryStats.completedCount === 1 ? "item" : "items"
                } from your shared list for both of you. This cannot be undone.`}
              </Text>

              <View style={styles.deleteConfirmDetailsBox}>
                <Text style={styles.deleteConfirmTitle}>
                  {categoryStats.completedCount} completed{" "}
                  {categoryStats.completedCount === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.deleteConfirmCategory}>
                  Category:{" "}
                  {activeCategory !== "all"
                    ? getCategoryLabel(activeCategory)
                    : ""}
                </Text>
              </View>

              <View style={styles.modalActionsRow}>
                <CouplyQuietButton
                  label="Keep items"
                  onPress={() => setIsClearCompletedConfirmVisible(false)}
                  disabled={isBulkActionSubmitting}
                  accessibilityLabel="Keep items"
                  style={styles.modalCancelBtn}
                />
                <CouplyPrimaryButton
                  label="Clear completed"
                  onPress={handleExecuteClearCompleted}
                  disabled={isBulkActionSubmitting}
                  loading={isBulkActionSubmitting}
                  accessibilityLabel="Clear completed"
                  style={[
                    styles.modalSubmitBtn,
                    {
                      backgroundColor: theme.status.error.bg,
                      borderColor: theme.status.error.border,
                    },
                  ]}
                  textStyle={{ color: theme.status.error.text }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove All Items Confirmation Modal */}
      <Modal
        visible={isRemoveAllConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isBulkActionSubmitting) {
            setIsRemoveAllConfirmVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Remove all{" "}
                {activeCategory !== "all"
                  ? getCategoryAdjective(activeCategory)
                  : ""}{" "}
                items?
              </Text>
              <Text style={styles.modalSubtitle}>
                {`This will remove ${categoryStats.totalCount} ${
                  categoryStats.totalCount === 1 ? "item" : "items"
                } from your shared list. All open and completed items in this category will disappear for both partners. This cannot be undone.`}
              </Text>

              <View style={styles.deleteConfirmDetailsBox}>
                <Text style={styles.deleteConfirmTitle}>
                  {categoryStats.totalCount}{" "}
                  {categoryStats.totalCount === 1 ? "item" : "items"} (
                  {categoryStats.openCount} open,{" "}
                  {categoryStats.completedCount} completed)
                </Text>
                <Text style={styles.deleteConfirmCategory}>
                  Category:{" "}
                  {activeCategory !== "all"
                    ? getCategoryLabel(activeCategory)
                    : ""}
                </Text>
              </View>

              <View style={styles.modalActionsRow}>
                <CouplyQuietButton
                  label="Keep items"
                  onPress={() => setIsRemoveAllConfirmVisible(false)}
                  disabled={isBulkActionSubmitting}
                  accessibilityLabel="Keep items"
                  style={styles.modalCancelBtn}
                />
                <CouplyPrimaryButton
                  label="Remove all"
                  onPress={handleExecuteRemoveAll}
                  disabled={isBulkActionSubmitting}
                  loading={isBulkActionSubmitting}
                  accessibilityLabel="Remove all"
                  style={[
                    styles.modalSubmitBtn,
                    {
                      backgroundColor: theme.status.error.bg,
                      borderColor: theme.status.error.border,
                    },
                  ]}
                  textStyle={{ color: theme.status.error.text }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <AppBottomNav activeTab="our_space" />
    </SafeAreaView>
  );
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: tokens.spacing.page,
      paddingTop: tokens.spacing.md,
      paddingBottom: 120,
    },
    mainColumn: {
      width: "100%",
      maxWidth: 540,
      alignSelf: "center",
    },

    /* Header right slot button */
    headerAddBtn: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.small,
      minHeight: 48,
      justifyContent: "center",
    },
    headerAddBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },

    /* Open count indicator row */
    openCountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    openCountText: {
      fontSize: tokens.typeScale.body,
      color: theme.secondaryText,
      fontWeight: "500",
    },
    quickStartPillBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.pill,
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1,
      minHeight: 48,
      justifyContent: "center",
    },
    quickStartPillBtnText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.primaryAccent,
    },

    /* Category Filter Chips */
    categoryChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    categoryChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: tokens.radii.pill,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      minHeight: 48,
      justifyContent: "center",
    },
    categoryChipActive: {
      backgroundColor: theme.selectedNavigation,
      borderColor: theme.primaryAccent,
    },
    categoryChipText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "500",
      color: theme.secondaryText,
    },
    categoryChipTextActive: {
      color: theme.primaryAccent,
      fontWeight: "700",
    },

    /* List Section */
    listSection: {
      gap: 10,
    },
    taskCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      borderRadius: tokens.radii.card,
      paddingVertical: 10,
      paddingHorizontal: 12,
      minHeight: 56,
      gap: 10,
    },
    completedTaskCard: {
      opacity: 0.8,
      backgroundColor: theme.secondarySurface,
      borderColor: theme.borderSoft,
    },

    /* Checkbox */
    checkboxTouch: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.8,
      borderColor: theme.mutedText,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    checkboxCircleChecked: {
      backgroundColor: theme.primaryAccent,
      borderColor: theme.primaryAccent,
    },
    checkGlyph: {
      color: theme.primaryActionText,
      fontSize: 12,
      fontWeight: "800",
    },

    /* Task text & meta */
    taskTextCol: {
      flex: 1,
      gap: 4,
      justifyContent: "center",
    },
    taskTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "500",
      color: theme.primaryText,
      lineHeight: 20,
    },
    completedTaskTitle: {
      textDecorationLine: "line-through",
      color: theme.secondaryText,
    },
    taskMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    /* Task Action Buttons */
    taskActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    iconActionBtn: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      minHeight: 48,
      minWidth: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    editActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryAccent,
    },
    reopenActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryAccent,
    },
    deleteActionText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.secondaryText,
    },

    /* Completed Collapsible Section */
    completedSection: {
      marginTop: 18,
      gap: 8,
    },
    completedHeaderToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 6,
      minHeight: 48,
    },
    completedHeaderTitle: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    completedHeaderChevron: {
      fontSize: 14,
      color: theme.secondaryText,
    },

    /* Empty state */
    emptyWrap: {
      marginTop: 20,
    },
    emptyActionsCol: {
      gap: 12,
      width: "100%",
      maxWidth: 280,
      marginTop: 8,
    },
    emptyActionBtn: {
      minHeight: 48,
    },

    /* Quiet placeholder */
    quietPlaceholder: {
      paddingVertical: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    quietPlaceholderText: {
      fontSize: tokens.typeScale.body,
      color: theme.secondaryText,
      fontStyle: "italic",
    },

    /* Loading Skeletons */
    loadingContainer: {
      paddingHorizontal: tokens.spacing.page,
      marginTop: 24,
      gap: 14,
      alignItems: "center",
    },
    loadingText: {
      fontSize: tokens.typeScale.body,
      color: theme.secondaryText,
      marginBottom: 8,
    },
    skeletonCard: {
      width: "100%",
      maxWidth: 540,
      height: 60,
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: tokens.radii.card,
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    modalContainer: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "92%",
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      borderRadius: tokens.radii.large,
      padding: 18,
      gap: 12,
      maxHeight: "100%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    quickStartModalCard: {
      maxHeight: "100%",
    },
    modalTitle: {
      fontSize: tokens.typeScale.screenTitle - 4,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    modalErrorBanner: {
      backgroundColor: theme.status.error.bg,
      borderColor: theme.status.error.border,
      borderWidth: 1,
      borderRadius: tokens.radii.small,
      padding: 10,
    },
    modalErrorBannerText: {
      color: theme.status.error.text,
      fontSize: tokens.typeScale.caption,
      fontWeight: "500",
    },
    formGroup: {
      gap: 6,
    },
    formLabel: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: theme.primaryText,
    },
    textInput: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1.2,
      borderRadius: tokens.radii.small,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: tokens.typeScale.bodyLarge,
      color: theme.primaryText,
      minHeight: 48,
    },
    charCounter: {
      fontSize: tokens.typeScale.overline,
      color: theme.mutedText,
      textAlign: "right",
    },
    categoryRadioRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryRadioBtn: {
      flex: 1,
      minWidth: 85,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: tokens.radii.small,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    categoryRadioBtnActive: {
      backgroundColor: theme.selectedNavigation,
      borderColor: theme.primaryAccent,
    },
    categoryRadioBtnText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "500",
      color: theme.secondaryText,
    },
    categoryRadioBtnTextActive: {
      color: theme.primaryAccent,
      fontWeight: "700",
    },
    modalActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 8,
    },
    modalCancelBtn: {
      minHeight: 48,
      paddingHorizontal: 16,
    },
    modalSubmitBtn: {
      minHeight: 48,
      paddingHorizontal: 20,
    },

    /* Delete confirm details */
    deleteConfirmDetailsBox: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: tokens.radii.small,
      padding: 12,
      gap: 4,
    },
    deleteConfirmTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "600",
      color: theme.primaryText,
    },
    deleteConfirmCategory: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
    },

    /* Quick Start Templates */
    templateListScroll: {
      maxHeight: 340,
    },
    templateChoiceCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      borderRadius: tokens.radii.card,
      padding: 14,
      marginBottom: 10,
      minHeight: 56,
    },
    templateChoiceContent: {
      flex: 1,
      gap: 2,
    },
    templateChoiceName: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "600",
      color: theme.primaryText,
    },
    templateChoiceDesc: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
    },
    templateChoiceCount: {
      fontSize: tokens.typeScale.overline,
      color: theme.primaryAccent,
      marginTop: 2,
      fontWeight: "600",
    },
    templateChoiceChevron: {
      fontSize: 20,
      color: theme.primaryAccent,
      marginLeft: 10,
    },

    /* Template Review List */
    templateReviewListScroll: {
      flexShrink: 1,
      maxHeight: 280,
    },
    reviewItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      paddingVertical: 2,
    },
    reviewItemInput: {
      flex: 1,
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: tokens.radii.small,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: tokens.typeScale.body,
      color: theme.primaryText,
      minHeight: 48,
    },
    reviewItemInputDeselected: {
      opacity: 0.5,
      textDecorationLine: "line-through",
    },
    addTemplateRowBtn: {
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    addTemplateRowBtnText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: theme.primaryAccent,
    },

    /* Category Bar & Overflow Action */
    categoryBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: tokens.radii.card,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
      minHeight: 52,
    },
    categoryBarTextCol: {
      flex: 1,
      gap: 2,
      marginRight: 8,
    },
    categoryBarTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    categoryBarSubtitle: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
    },
    /* Helper line when All is selected */
    allCategoryHelperRow: {
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    allCategoryHelperText: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
      lineHeight: 18,
    },

    /* Manage category button */
    manageCategoryBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.pill,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1.2,
      minHeight: 44,
      gap: 4,
    },
    manageCategoryBtnText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.primaryAccent,
    },
    manageCategoryBtnChevron: {
      fontSize: 12,
      color: theme.primaryAccent,
      marginTop: 1,
    },

    /* Calm Feedback Banner */
    feedbackBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: tokens.radii.small,
      marginBottom: 12,
      borderWidth: 1.2,
      gap: 10,
    },
    feedbackBannerSuccess: {
      backgroundColor: theme.status.reconnected.bg,
      borderColor: theme.status.reconnected.border,
    },
    feedbackBannerNotice: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.border,
    },
    feedbackBannerError: {
      backgroundColor: theme.status.error.bg,
      borderColor: theme.status.error.border,
    },
    feedbackBannerText: {
      flex: 1,
      fontSize: tokens.typeScale.caption,
      fontWeight: "500",
      lineHeight: 18,
    },
    feedbackBannerTextSuccess: {
      color: theme.status.reconnected.text,
    },
    feedbackBannerTextNotice: {
      color: theme.primaryText,
    },
    feedbackBannerTextError: {
      color: theme.status.error.text,
    },
    feedbackDismissBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    feedbackDismissText: {
      fontSize: 14,
      color: theme.secondaryText,
      fontWeight: "600",
    },

    /* Overflow Menu Card & Items */
    menuCard: {
      maxWidth: 420,
      width: "100%",
      gap: 14,
    },
    menuHeader: {
      gap: 4,
    },
    menuItemsList: {
      gap: 8,
    },
    menuItemRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.small,
      backgroundColor: theme.secondarySurface,
      borderWidth: 1.2,
      borderColor: theme.border,
      gap: 12,
    },
    menuItemRowDestructive: {
      backgroundColor: theme.status.error.bg,
      borderColor: theme.status.error.border,
    },
    menuItemIconBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    menuItemIconBoxDestructive: {
      backgroundColor: theme.surface,
    },
    menuItemIconGlyph: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    menuItemIconGlyphDestructive: {
      fontSize: 14,
      color: theme.status.error.text,
    },
    menuItemTextCol: {
      flex: 1,
      gap: 2,
    },
    menuItemTitle: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: theme.primaryText,
    },
    menuItemTitleDestructive: {
      color: theme.status.error.text,
    },
    menuItemDescription: {
      fontSize: tokens.typeScale.caption,
      color: theme.secondaryText,
      lineHeight: 16,
    },

    pressedState: {
      opacity: 0.7,
    },
  });

