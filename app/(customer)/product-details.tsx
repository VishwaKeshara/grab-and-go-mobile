import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  PrimaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
  addFavourite,
  createProductReview,
  getProduct,
  listFavouriteIds,
  listProductReviews,
  removeFavourite,
} from "@/services/productService";
import type { ProductWithShop, Review } from "@/types/product";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatCurrency, formatRelativeTime } from "@/utils/formatters";

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ProductWithShop | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavourite, setIsFavourite] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingFavourite, setSavingFavourite] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    let active = true;
    getProduct(id)
      .then((item) => {
        if (active) setProduct(item);
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load this product.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    listProductReviews(id)
      .then((items) => {
        if (active) setReviews(items);
      })
      .catch(() => undefined);

    listFavouriteIds()
      .then((ids) => {
        if (active) setIsFavourite(ids.includes(id));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [id]);

  const toggleFavourite = useCallback(async () => {
    if (!id || savingFavourite) return;
    const next = !isFavourite;
    setIsFavourite(next);
    setSavingFavourite(true);
    setError("");
    try {
      if (next) await addFavourite(id);
      else await removeFavourite(id);
    } catch (favError) {
      setIsFavourite(!next);
      setError(
        favError instanceof Error
          ? favError.message
          : "We could not update your favourites.",
      );
    } finally {
      setSavingFavourite(false);
    }
  }, [id, isFavourite, savingFavourite]);

  const submitReview = async () => {
    if (!id) return;
    if (rating === 0) {
      setError("Choose a star rating before posting your review.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await createProductReview(id, rating, comment);
      setReviews(await listProductReviews(id));
      setComment("");
      setRating(0);
      setNotice("✓ Review posted");
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "We could not post your review.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  const missingId = !id;
  const showLoading = loading && !missingId;

  return (
    <AuthFrame>
      <AuthHeader title="Product Details" />
      {missingId ? (
        <ErrorBanner message="This product could not be found." />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : null}
      {showLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      ) : product ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroThumb}>
              <Text style={styles.heroThumbText}>
                {product.name.slice(0, 1)}
              </Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.category}>{product.category}</Text>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.shop}>🏪 {product.shop_name}</Text>
              <Text style={styles.price}>{formatCurrency(product.price)}</Text>
              <Text style={styles.unit}>per {product.unit}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleFavourite}
            style={({ pressed }) => [
              styles.favourite,
              isFavourite && styles.favouriteOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.favouriteText, isFavourite && styles.favouriteTextOn]}>
              {isFavourite ? "♥ Saved to favourites" : "♡ Add to favourites"}
            </Text>
          </Pressable>
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Availability</Text>
              <Text
                style={[
                  styles.metaValue,
                  product.stock_quantity === 0 && styles.metaValueWarn,
                ]}
              >
                {product.stock_quantity === 0
                  ? "Out of stock"
                  : `${product.stock_quantity} ${product.unit} left`}
              </Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Rating</Text>
              <Text style={styles.metaValue}>
                {reviews.length > 0
                  ? `${averageRating.toFixed(1)} ★ (${reviews.length})`
                  : "No reviews yet"}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>About this product</Text>
          <Text style={styles.description}>
            {product.description || "No description provided for this product."}
          </Text>
          <Text style={styles.sectionTitle}>
            Reviews {reviews.length > 0 ? `(${reviews.length})` : ""}
          </Text>
          <View style={styles.reviewForm}>
            <Text style={styles.formLabel}>Your rating</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                  key={value}
                  onPress={() => setRating(value)}
                  style={styles.star}
                >
                  <Text
                    style={[
                      styles.starText,
                      value <= rating && styles.starTextOn,
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              multiline
              onChangeText={setComment}
              placeholder="Share your experience with this product"
              placeholderTextColor="#9A98AA"
              style={styles.comment}
              value={comment}
            />
            <PrimaryButton loading={submitting} onPress={submitReview}>
              Post review
            </PrimaryButton>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </View>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewStars}>
                  {"★".repeat(review.rating)}
                  <Text style={styles.reviewStarsOff}>
                    {"★".repeat(5 - review.rating)}
                  </Text>
                </Text>
                <Text style={styles.reviewTime}>
                  {formatRelativeTime(review.created_at)}
                </Text>
              </View>
              {review.comment ? (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>▣</Text>
          <Text style={styles.emptyTitle}>Product unavailable</Text>
          <Text style={styles.emptyText}>
            This product may have been removed or is not currently listed.
          </Text>
        </View>
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 40 },
  loadingText: { color: colors.muted, fontSize: 12, marginTop: 10 },
  hero: {
    backgroundColor: "#E7E9FC",
    borderRadius: 15,
    flexDirection: "row",
    marginBottom: 14,
    padding: 14,
  },
  heroThumb: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 14,
    height: 74,
    justifyContent: "center",
    width: 74,
  },
  heroThumbText: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  heroCopy: { flex: 1, marginLeft: 13 },
  category: {
    color: "#07856A",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: 5,
  },
  shop: { color: colors.muted, fontSize: 10, marginTop: 5 },
  price: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 7,
  },
  unit: { color: colors.muted, fontSize: 9, marginTop: 2 },
  favourite: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 14,
    minHeight: 48,
  },
  favouriteOn: { backgroundColor: colors.mintSoft, borderColor: colors.mint },
  favouriteText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  favouriteTextOn: { color: "#07856A" },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  metaCard: {
    backgroundColor: "#F0F1FC",
    borderRadius: 11,
    flex: 1,
    padding: 12,
  },
  metaLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  metaValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  metaValueWarn: { color: colors.coral },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 9,
  },
  description: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 18,
  },
  reviewForm: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 14,
    padding: 13,
  },
  formLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  stars: { flexDirection: "row", gap: 6, marginBottom: 12 },
  star: { paddingHorizontal: 3 },
  starText: { color: "#DEDDEC", fontSize: 25 },
  starTextOn: { color: colors.amber },
  comment: {
    backgroundColor: "#F0F1FC",
    borderRadius: 11,
    color: colors.ink,
    fontSize: 12,
    minHeight: 76,
    padding: 12,
    textAlignVertical: "top",
  },
  notice: {
    color: "#07856A",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 9,
    padding: 12,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewStars: { color: colors.amber, fontSize: 12 },
  reviewStarsOff: { color: "#DEDDEC" },
  reviewTime: { color: colors.muted, fontSize: 9 },
  reviewComment: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 16,
    marginTop: 20,
    padding: 28,
  },
  emptyIcon: { color: colors.mint, fontSize: 32 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
    textAlign: "center",
  },
  pressed: { opacity: 0.8 },
});