import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
    deleteNotification,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    Notification,
} from "@/services/notificationService";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listNotifications()
      .then((items) => {
        if (active) setNotifications(items);
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load your notifications.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const markAll = async () => {
    await markAllNotificationsRead();
    setNotifications((items) =>
      items.map((item) => ({ ...item, is_read: true })),
    );
  };

  const markRead = async (notification: Notification) => {
    if (notification.is_read) return;
    await markNotificationRead(notification.id);
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item,
      ),
    );
  };

  const remove = async (id: string) => {
    await deleteNotification(id);
    setNotifications((items) => items.filter((item) => item.id !== id));
  };

  return (
    <AuthFrame>
      <AuthHeader title="Notifications" />
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.heading}>Updates for you</Text>
          <Text style={styles.subtitle}>
            Your orders, pickups, and local offers in one place.
          </Text>
        </View>
        <Pressable onPress={markAll}>
          <Text style={styles.markAll}>✓ Mark all read</Text>
        </Pressable>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Text style={styles.emptyText}>Loading your updates...</Text>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
          <Text style={styles.emptyText}>
            New pickup updates and local offers will show up here.
          </Text>
        </View>
      ) : (
        notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDelete={() => remove(notification.id)}
            onRead={() => markRead(notification)}
          />
        ))
      )}
      <SecondaryButton onPress={() => undefined}>
        Notification preferences
      </SecondaryButton>
    </AuthFrame>
  );
}

function NotificationCard({
  notification,
  onDelete,
  onRead,
}: {
  notification: Notification;
  onDelete: () => void;
  onRead: () => void;
}) {
  return (
    <Pressable
      onPress={onRead}
      style={[styles.card, !notification.is_read && styles.unreadCard]}
    >
      <View
        style={[
          styles.cardIcon,
          { backgroundColor: iconColor(notification.kind) },
        ]}
      >
        <Text>{iconFor(notification.kind)}</Text>
      </View>
      <View style={styles.cardCopy}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{notification.title}</Text>
          {!notification.is_read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.cardBody}>{notification.body}</Text>
        <Text style={styles.time}>{timeLabel(notification.created_at)}</Text>
        {notification.action_label ? (
          <Text style={styles.action}>{notification.action_label} →</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Delete notification"
        onPress={onDelete}
        style={styles.delete}
      >
        <Text>×</Text>
      </Pressable>
    </Pressable>
  );
}

function iconFor(kind: Notification["kind"]) {
  return kind === "order"
    ? "▣"
    : kind === "pickup"
      ? "⌂"
      : kind === "price"
        ? "%"
        : kind === "offer"
          ? "✦"
          : "●";
}
function iconColor(kind: Notification["kind"]) {
  return kind === "order"
    ? "#D8ECDD"
    : kind === "pickup"
      ? "#FFE3BC"
      : kind === "price"
        ? "#DDE2FF"
        : colors.mintSoft;
}
function timeLabel(value: string) {
  const hours = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 3600000),
  );
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 19,
  },
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    maxWidth: 210,
  },
  markAll: { color: "#07856A", fontSize: 9, fontWeight: "800", marginTop: 5 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 11,
    padding: 12,
  },
  unreadCard: {
    borderColor: "#B8B9F0",
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  cardCopy: { flex: 1, marginLeft: 10 },
  cardTitleRow: { alignItems: "center", flexDirection: "row" },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" },
  unreadDot: {
    backgroundColor: colors.coral,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  cardBody: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  time: { color: "#9A98AA", fontSize: 9, marginTop: 8 },
  action: { color: colors.ink, fontSize: 10, fontWeight: "800", marginTop: 8 },
  delete: { alignSelf: "flex-start", paddingLeft: 8 },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 16,
    marginTop: 22,
    padding: 28,
  },
  emptyIcon: { color: colors.mint, fontSize: 34 },
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
});
