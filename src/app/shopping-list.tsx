import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { EmptyState } from "@/components/ui/EmptyState";
import { Color, Radius, Spacing } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import { tapFeedback } from "@/lib/haptics";
import { parseIngredientText } from "@/lib/ingredient-text";
import {
  useAddShoppingListItems,
  useDeleteShoppingListItem,
  useShoppingList,
  useToggleShoppingListItem,
  type ShoppingListItem,
} from "@/lib/queries/shopping-list";
import { useDeleteRecipe, useRecipes, type Recipe } from "@/lib/queries/recipes";

type ViewMode = "list" | "recipes";

function formatQuantity(item: ShoppingListItem): string | null {
  if (item.quantity === null) return null;
  return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
}

function ShoppingListRow({ item }: { item: ShoppingListItem }) {
  const toggle = useToggleShoppingListItem();
  const del = useDeleteShoppingListItem();
  const qty = formatQuantity(item);

  return (
    <View style={styles.itemRow}>
      <Pressable
        onPress={() => {
          tapFeedback();
          toggle.mutate(item.id);
        }}
        hitSlop={8}
      >
        <Ionicons
          name={item.checked ? "checkbox" : "square-outline"}
          size={22}
          color={item.checked ? Color.textFaint : Color.gold}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]} numberOfLines={2}>
          {item.displayText}
        </Text>
        {qty ? <Text style={styles.itemQty}>{qty}</Text> : null}
      </View>
      <Pressable onPress={() => del.mutate(item.id)} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={Color.textFaint} />
      </Pressable>
    </View>
  );
}

function ShoppingListView() {
  const { data: items, isLoading } = useShoppingList();
  const addItems = useAddShoppingListItems();
  const [newItemText, setNewItemText] = useState("");

  const { unchecked, checked } = useMemo(() => {
    const all = items ?? [];
    return { unchecked: all.filter((i) => !i.checked), checked: all.filter((i) => i.checked) };
  }, [items]);

  function handleAdd() {
    const text = newItemText.trim();
    if (!text) return;
    tapFeedback();
    addItems.mutate([parseIngredientText(text)]);
    trackEvent("shopping_list_item_added", { count: 1 });
    setNewItemText("");
  }

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Color.gold} size="large" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.addRow}>
        <TextInput
          value={newItemText}
          onChangeText={setNewItemText}
          placeholder="+ Add an item, e.g. 2 cans chickpeas"
          placeholderTextColor={Color.textFaint}
          style={styles.addInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable onPress={handleAdd} disabled={!newItemText.trim() || addItems.isPending} style={styles.addButton}>
          <Ionicons name="add" size={20} color={Color.gold} />
        </Pressable>
      </View>

      {unchecked.length === 0 && checked.length === 0 ? (
        <Card tier="quiet">
          <EmptyState
            icon="cart-outline"
            title="No items yet"
            body="Add what you need to buy above, or add ingredients from a saved recipe."
          />
        </Card>
      ) : (
        <>
          {unchecked.length > 0 ? (
            <Card style={styles.itemList}>
              {unchecked.map((item, idx) => (
                <View key={item.id} style={idx > 0 ? styles.itemDivider : undefined}>
                  <ShoppingListRow item={item} />
                </View>
              ))}
            </Card>
          ) : null}

          {checked.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>CHECKED</Text>
              <Card tier="quiet" style={styles.itemList}>
                {checked.map((item, idx) => (
                  <View key={item.id} style={idx > 0 ? styles.itemDivider : undefined}>
                    <ShoppingListRow item={item} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const addItems = useAddShoppingListItems();
  const deleteRecipe = useDeleteRecipe();
  const [added, setAdded] = useState(false);

  function handleAddToList() {
    tapFeedback();
    addItems.mutate(
      recipe.ingredients.map((ing) => ({ ...ing, sourceRecipeId: recipe.id })),
      {
        onSuccess: () => {
          setAdded(true);
          trackEvent("shopping_list_recipe_ingredients_added", { recipeId: recipe.id, count: recipe.ingredients.length });
        },
      }
    );
  }

  return (
    <Card style={styles.recipeCard}>
      <Collapsible title={recipe.title} summary={`${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? "" : "s"}`}>
        {recipe.ingredients.map((ing, idx) => (
          <Text key={idx} style={styles.recipeIngredient}>
            {ing.displayText}
          </Text>
        ))}
        {recipe.notes ? <Text style={styles.recipeNotes}>{recipe.notes}</Text> : null}
        <View style={styles.recipeActionsRow}>
          <Button
            title={added ? "Added" : "Add ingredients to list"}
            variant="secondary"
            onPress={handleAddToList}
            disabled={added}
            loading={addItems.isPending}
            style={{ flex: 1 }}
          />
          <Pressable onPress={() => deleteRecipe.mutate(recipe.id)} hitSlop={8} style={styles.recipeDeleteButton}>
            <Ionicons name="trash-outline" size={18} color={Color.textFaint} />
          </Pressable>
        </View>
      </Collapsible>
    </Card>
  );
}

function RecipesView() {
  const router = useRouter();
  const { data: recipes, isLoading } = useRecipes();

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Color.gold} size="large" />
      </View>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <Card tier="quiet">
        <EmptyState
          icon="bookmark-outline"
          title="No saved recipes yet"
          body="Save a recipe from What Can I Make? to see it here."
          actionLabel="Go to What Can I Make?"
          onAction={() => router.push("/meal-suggest")}
          variant="primary"
        />
      </Card>
    );
  }

  return (
    <>
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </>
  );
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.viewToggle}>
        <Pressable onPress={() => setView("list")} style={[styles.viewChip, view === "list" && styles.viewChipActive]}>
          <Text style={[styles.viewChipText, view === "list" && styles.viewChipTextActive]}>List</Text>
        </Pressable>
        <Pressable onPress={() => setView("recipes")} style={[styles.viewChip, view === "recipes" && styles.viewChipActive]}>
          <Text style={[styles.viewChipText, view === "recipes" && styles.viewChipTextActive]}>Recipes</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {view === "list" ? <ShoppingListView /> : <RecipesView />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  viewToggle: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  viewChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingVertical: 8,
  },
  viewChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  viewChipText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  viewChipTextActive: { color: Color.gold },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  addRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  addInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  itemList: { padding: 0, overflow: "hidden", marginBottom: Spacing.md },
  itemDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  itemRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md },
  itemText: { fontSize: 14, fontWeight: "500", color: Color.textPrimary },
  itemTextChecked: { color: Color.textFaint, textDecorationLine: "line-through" },
  itemQty: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  recipeCard: { padding: Spacing.md, marginBottom: Spacing.md },
  recipeIngredient: { fontSize: 13, color: Color.textSecondary, marginTop: 4 },
  recipeNotes: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm, fontStyle: "italic" },
  recipeActionsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  recipeDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
});
