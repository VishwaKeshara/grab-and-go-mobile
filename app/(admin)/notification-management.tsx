import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  Field,
  PrimaryButton,
  SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
  AdminNotification,
  AdminNotificationInput,
  createAdminNotification,
  deleteAdminNotification,
  listAdminNotifications,
  markAdminNotificationRead,
  updateAdminNotification,
} from "@/services/adminNotificationService";
import { listManagedUsers, ManagedUser } from "@/services/adminService";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Form = AdminNotificationInput;
const emptyForm: Form = {
  userId: "all-customers",
  kind: "general",
  title: "",
  body: "",
  actionLabel: "",
  actionRoute: "",
};

export default function NotificationManagement() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, managedUsers] = await Promise.all([
        listAdminNotifications(),
        listManagedUsers(),
      ]);
      setNotifications(items);
      setUsers(managedUsers.filter((user) => user.status === "active"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setVisible(true);
  };

  const openEdit = (notification: AdminNotification) => {
    setEditing(notification);
    setForm({
      userId: notification.user_id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      actionLabel: notification.action_label ?? "",
      actionRoute: notification.action_route ?? "",
    });
    setError("");
    setVisible(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const saved = await updateAdminNotification(editing.id, form);
        setNotifications((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved, recipient_name: item.recipient_name, recipient_email: item.recipient_email } : item));
        setSuccess("Notification updated.");
      } else {
        const created = await createAdminNotification(form);
        setSuccess(`${created.length} notification${created.length === 1 ? "" : "s"} created.`);
        await load();
      }
      setVisible(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save notification.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (notification: AdminNotification) => {
    Alert.alert("Delete notification", "This permanently removes the notification for the recipient.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteAdminNotification(notification.id);
            setNotifications((items) => items.filter((item) =>
              result.campaignId
                ? item.campaign_id !== result.campaignId
                : item.id !== notification.id,
            ));
            setSuccess("Notification deleted.");
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Could not delete notification.");
          }
        },
      },
    ]);
  };

  const toggleRead = async (notification: AdminNotification) => {
    try {
      const saved = await markAdminNotificationRead(notification.id, !notification.is_read);
      setNotifications((items) => items.map((item) => item.id === saved.id ? { ...item, is_read: saved.is_read } : item));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not update notification status.");
    }
  };

  return (
    <AuthFrame>
      <AuthHeader eyebrow="ADMIN • MALABE" title="Notification Management" subtitle="Create and maintain customer updates." />
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>NOTIFICATION REGISTRY</Text>
          <Text style={styles.heroTitle}>{notifications.length} messages</Text>
          <Text style={styles.heroText}>Send updates to customers, shop owners, staff, or administrators.</Text>
        </View>
        <Pressable onPress={openCreate} style={styles.addButton}><Text style={styles.addText}>+ Create</Text></Pressable>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <Pressable onPress={() => setSuccess("")} style={styles.success}><Text style={styles.successText}>{success}  Dismiss</Text></Pressable> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.emptyText}>Loading notifications...</Text></View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No notifications yet</Text><Text style={styles.emptyText}>Create the first team or customer notification.</Text></View>
      ) : notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} onEdit={() => openEdit(notification)} onDelete={() => remove(notification)} onToggleRead={() => void toggleRead(notification)} />
      ))}
      <SecondaryButton onPress={() => void load()}>Refresh notifications</SecondaryButton>
      <NotificationForm visible={visible} editing={Boolean(editing)} form={form} users={users} saving={saving} onChange={(changes) => setForm((current) => ({ ...current, ...changes }))} onClose={() => setVisible(false)} onSave={() => void save()} />
    </AuthFrame>
  );
}

function NotificationCard({ notification, onEdit, onDelete, onToggleRead }: { notification: AdminNotification; onEdit: () => void; onDelete: () => void; onToggleRead: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.kind}>{notification.kind.toUpperCase()}</Text>
        <View style={[styles.readPill, notification.is_read ? styles.read : styles.unread]}><Text style={styles.pillText}>{notification.is_read ? "Read" : "Unread"}</Text></View>
      </View>
      <Text style={styles.cardTitle}>{notification.title}</Text>
      <Text style={styles.cardBody}>{notification.body}</Text>
      <Text style={styles.recipient}>To: {notification.recipient_name || notification.recipient_email || notification.user_id}</Text>
      <Text style={styles.time}>{new Date(notification.created_at).toLocaleString()}</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={onToggleRead} style={styles.actionButton}><Text style={styles.actionText}>{notification.is_read ? "Mark unread" : "Mark read"}</Text></Pressable>
        <Pressable onPress={onEdit} style={styles.actionButton}><Text style={styles.actionText}>Edit</Text></Pressable>
        <Pressable onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
      </View>
    </View>
  );
}

function NotificationForm({ visible, editing, form, users, saving, onChange, onClose, onSave }: { visible: boolean; editing: boolean; form: Form; users: ManagedUser[]; saving: boolean; onChange: (changes: Partial<Form>) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>{editing ? "EDIT MESSAGE" : "NEW MESSAGE"}</Text><Text style={styles.modalTitle}>{editing ? "Edit notification" : "Create notification"}</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
        <Text style={styles.formLabel}>Recipient</Text>
        <View style={styles.chips}>
          {!editing ? (
            <>
              <Chip label="Customers" active={form.userId === "all-customers"} onPress={() => onChange({ userId: "all-customers" })} />
              <Chip label="Shop owners" active={form.userId === "all-shop-owners"} onPress={() => onChange({ userId: "all-shop-owners" })} />
              <Chip label="Staff" active={form.userId === "all-staff"} onPress={() => onChange({ userId: "all-staff" })} />
              <Chip label="Admins" active={form.userId === "all-admins"} onPress={() => onChange({ userId: "all-admins" })} />
            </>
          ) : <Chip label="Current recipient" active onPress={() => undefined} />}
          {users.map((user) => <Chip key={user.id} label={user.full_name || user.email || "User"} active={form.userId === user.id} onPress={() => onChange({ userId: user.id })} />)}
        </View>
        <Text style={styles.formLabel}>Type</Text>
        <View style={styles.chips}>{(["general", "order", "price", "pickup", "offer", "security"] as const).map((kind) => <Chip key={kind} label={kind} active={form.kind === kind} onPress={() => onChange({ kind })} />)}</View>
        <Field label="Title" onChangeText={(title) => onChange({ title })} placeholder="e.g. Pickup ready" value={form.title} />
        <Field label="Message" multiline onChangeText={(body) => onChange({ body })} placeholder="Write the notification message" value={form.body} />
        <Field label="Action label (optional)" onChangeText={(actionLabel) => onChange({ actionLabel })} placeholder="e.g. View order" value={form.actionLabel} />
        <Field label="Action route (optional)" onChangeText={(actionRoute) => onChange({ actionRoute })} placeholder="e.g. /(customer)/my-orders" value={form.actionRoute} />
        <PrimaryButton loading={saving} onPress={onSave}>{editing ? "Save changes" : "Create notification"}</PrimaryButton>
        <SecondaryButton onPress={onClose}>Cancel</SecondaryButton>
      </View></View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 16, flexDirection: "row", marginBottom: 16, padding: 16 },
  heroEyebrow: { color: colors.mint, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: "900", marginTop: 4 },
  heroText: { color: "#CFCDF9", fontSize: 10, lineHeight: 15, marginTop: 4 },
  addButton: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  addText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  success: { backgroundColor: colors.mintSoft, borderRadius: 10, marginBottom: 12, padding: 10 },
  successText: { color: "#08745B", fontSize: 11, fontWeight: "700" },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, marginBottom: 10, padding: 13 },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  kind: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  readPill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  read: { backgroundColor: colors.mintSoft }, unread: { backgroundColor: "#FFE0DC" }, pillText: { color: colors.ink, fontSize: 8, fontWeight: "800" },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 8 }, cardBody: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, recipient: { color: colors.ink, fontSize: 10, marginTop: 9 }, time: { color: "#9693A5", fontSize: 9, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 7, marginTop: 11 }, actionButton: { backgroundColor: "#ECEEFC", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 }, actionText: { color: colors.ink, fontSize: 9, fontWeight: "800" }, deleteButton: { backgroundColor: "#FFE8E4", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 }, deleteText: { color: colors.coral, fontSize: 9, fontWeight: "800" },
  loading: { alignItems: "center", padding: 24 }, empty: { alignItems: "center", backgroundColor: "#F0F1FC", borderRadius: 14, padding: 22 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 11, marginTop: 6, textAlign: "center" },
  backdrop: { backgroundColor: "rgba(17,15,61,0.5)", flex: 1, justifyContent: "flex-end" }, modal: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "94%", padding: 22 }, modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }, modalEyebrow: { color: "#0E8067", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, modalTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 3 }, close: { color: colors.ink, fontSize: 30 }, formLabel: { color: colors.ink, fontSize: 11, fontWeight: "700", marginBottom: 6 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }, chip: { backgroundColor: "#ECEEFC", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 }, chipActive: { backgroundColor: colors.ink }, chipText: { color: colors.ink, fontSize: 9, fontWeight: "700" }, chipTextActive: { color: colors.white },
});
