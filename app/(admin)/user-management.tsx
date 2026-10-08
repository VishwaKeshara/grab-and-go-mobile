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
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  ManagedUser,
  ManagedUserInput,
  updateManagedUser,
} from "@/services/adminService";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RoleFilter = "all" | ManagedUser["role"];
type StatusFilter = "all" | ManagedUser["status"];
type FormState = Omit<ManagedUserInput, "password"> & { password: string };

const emptyForm: FormState = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  role: "customer",
  status: "active",
};

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await listManagedUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesSearch =
        !term ||
        `${user.full_name} ${user.email ?? ""} ${user.phone ?? ""}`
          .toLowerCase()
          .includes(term);
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [roleFilter, search, statusFilter, users]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setFormVisible(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      email: user.email ?? "",
      password: "",
      fullName: user.full_name,
      phone: user.phone ?? "",
      role: user.role,
      status: user.status,
    });
    setError("");
    setFormVisible(true);
  };

  const saveUser = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    if (!editingUser && form.password.length < 8) {
      setError("New users need a password with at least 8 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input: ManagedUserInput = {
        email: form.email,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        status: form.status,
        ...(form.password ? { password: form.password } : {}),
      };
      const saved = editingUser
        ? await updateManagedUser(editingUser.id, input)
        : await createManagedUser(input);
      setUsers((items) =>
        editingUser
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      setFormVisible(false);
      setSuccess(editingUser ? "User updated successfully." : "User created successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this user.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (user: ManagedUser) => {
    Alert.alert(
      "Delete user",
      `Delete ${user.full_name || user.email || "this account"} permanently? This also removes their authentication account.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setError("");
            try {
              await deleteManagedUser(user.id);
              setUsers((items) => items.filter((item) => item.id !== user.id));
              setSuccess("User deleted successfully.");
            } catch (deleteError) {
              setError(deleteError instanceof Error ? deleteError.message : "Could not delete this user.");
            }
          },
        },
      ],
    );
  };

  return (
    <AuthFrame>
      <AuthHeader
        backRoute="/(admin)/admin-dashboard"
        eyebrow="ADMIN • MALABE"
        title="User Management"
      />
      <View style={styles.adminHero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>LIVE USER REGISTRY</Text>
          <Text style={styles.heroTitle}>{users.length.toLocaleString()} accounts</Text>
          <Text style={styles.heroText}>Manage access, roles, and account health from one secure workspace.</Text>
        </View>
        <View style={styles.heroRight}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeValue}>{users.filter((user) => user.status === "active").length}</Text>
            <Text style={styles.heroBadgeLabel}>active</Text>
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add user</Text>
          </Pressable>
        </View>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{success}</Text>
          <Pressable onPress={() => setSuccess("")}><Text style={styles.dismiss}>Dismiss</Text></Pressable>
        </View>
      ) : null}
      <Field label="Search users" onChangeText={setSearch} placeholder="Name, email or phone" value={search} />
      <Text style={styles.filterLabel}>Filter by role</Text>
      <FilterRow
        items={["all", "customer", "shop", "staff", "admin"] as const}
        selected={roleFilter}
        onSelect={setRoleFilter}
      />
      <Text style={styles.filterLabel}>Filter by status</Text>
      <FilterRow
        items={["all", "active", "suspended"] as const}
        selected={statusFilter}
        onSelect={setStatusFilter}
      />
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.emptyText}>Loading user registry...</Text></View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyText}>{users.length ? "Try another search or filter." : "Add your first user to get started."}</Text>
        </View>
      ) : (
        filteredUsers.map((user) => (
          <UserCard key={user.id} user={user} onEdit={() => openEdit(user)} onDelete={() => confirmDelete(user)} />
        ))
      )}
      <SecondaryButton onPress={loadUsers}>Refresh user list</SecondaryButton>
      <UserFormModal
        visible={formVisible}
        editing={Boolean(editingUser)}
        form={form}
        saving={saving}
        onChange={(changes) => setForm((current) => ({ ...current, ...changes }))}
        onClose={() => setFormVisible(false)}
        onSave={saveUser}
      />
    </AuthFrame>
  );
}

function FilterRow<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: readonly T[];
  selected: T;
  onSelect: (item: T) => void;
}) {
  return (
    <View style={styles.filters}>
      {items.map((item) => (
        <Pressable key={item} onPress={() => onSelect(item)} style={[styles.filter, selected === item && styles.filterActive]}>
          <Text style={[styles.filterText, selected === item && styles.filterTextActive]}>{item === "all" ? "All" : item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function UserCard({ user, onEdit, onDelete }: { user: ManagedUser; onEdit: () => void; onDelete: () => void }) {
  const active = user.status === "active";
  return (
    <View style={styles.userCard}>
      <View style={[styles.userAvatar, !active && styles.userAvatarSuspended]}>
        <Text style={styles.avatarText}>{user.full_name.slice(0, 2).toUpperCase() || "NA"}</Text>
      </View>
      <View style={styles.userCopy}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{user.full_name || "Unnamed account"}</Text>
          <View style={[styles.statusPill, active ? styles.activePill : styles.suspendedPill]}>
            <Text style={styles.statusText}>{active ? "Active" : "Suspended"}</Text>
          </View>
        </View>
        <Text style={styles.userContact}>{user.email || user.phone || "No contact details"}</Text>
        <Text style={styles.userMeta}>{user.role} • joined {new Date(user.created_at).toLocaleDateString()}</Text>
        <View style={styles.actionRow}>
          <Pressable onPress={onEdit} style={styles.editButton}><Text style={styles.editText}>Edit user</Text></Pressable>
          <Pressable onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function UserFormModal({
  visible,
  editing,
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  editing: boolean;
  form: FormState;
  saving: boolean;
  onChange: (changes: Partial<FormState>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.modalEyebrow}>{editing ? "ACCOUNT SETTINGS" : "NEW ACCOUNT"}</Text><Text style={styles.modalTitle}>{editing ? "Edit user" : "Add user"}</Text></View>
            <Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
          </View>
          <Field label="Full name" onChangeText={(fullName) => onChange({ fullName })} placeholder="User's full name" value={form.fullName} />
          <Field autoCapitalize="none" autoCorrect={false} keyboardType="email-address" label="Email address" onChangeText={(email) => onChange({ email })} placeholder="user@example.com" value={form.email} />
          <Field keyboardType="phone-pad" label="Phone number" onChangeText={(phone) => onChange({ phone })} placeholder="Optional" value={form.phone} />
          <Field label={editing ? "New password (optional)" : "Temporary password"} onChangeText={(password) => onChange({ password })} placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"} secureTextEntry value={form.password} />
          <Text style={styles.formLabel}>Role</Text>
          <FilterRow items={["customer", "shop", "staff", "admin"] as const} selected={form.role} onSelect={(role) => onChange({ role })} />
          <Text style={styles.formLabel}>Status</Text>
          <FilterRow items={["active", "suspended"] as const} selected={form.status} onSelect={(status) => onChange({ status })} />
          <PrimaryButton loading={saving} onPress={onSave}>{editing ? "Save changes" : "Create user"}</PrimaryButton>
          <SecondaryButton onPress={onClose}>Cancel</SecondaryButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  adminHero: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 16, flexDirection: "row", justifyContent: "space-between", marginBottom: 17, padding: 16 },
  heroCopy: { flex: 1, paddingRight: 8 },
  heroRight: { alignItems: "center", gap: 10 },
  heroEyebrow: { color: colors.mint, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: "900", marginTop: 5 },
  heroText: { color: "#CFCDF9", fontSize: 10, lineHeight: 15, marginTop: 3 },
  heroBadge: { alignItems: "center", backgroundColor: colors.mint, borderRadius: 35, height: 62, justifyContent: "center", width: 62 },
  heroBadgeValue: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  heroBadgeLabel: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  addButton: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  successBanner: { alignItems: "center", backgroundColor: colors.mintSoft, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 10 },
  successText: { color: "#08745B", flex: 1, fontSize: 11, fontWeight: "700" },
  dismiss: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  filterLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 6, marginTop: 2 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  filter: { backgroundColor: "#ECEEFC", borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7 },
  filterActive: { backgroundColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  filterTextActive: { color: colors.white },
  userCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flexDirection: "row", marginBottom: 10, padding: 11 },
  userAvatar: { alignItems: "center", backgroundColor: colors.mint, borderRadius: 21, height: 42, justifyContent: "center", width: 42 },
  userAvatarSuspended: { backgroundColor: "#FFC3BA" },
  avatarText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  userCopy: { flex: 1, marginLeft: 10 },
  userNameRow: { alignItems: "center", flexDirection: "row" },
  userName: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" },
  statusPill: { borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  activePill: { backgroundColor: colors.mintSoft },
  suspendedPill: { backgroundColor: "#FFE0DC" },
  statusText: { color: colors.ink, fontSize: 8, fontWeight: "800" },
  userContact: { color: colors.muted, fontSize: 10, marginTop: 4 },
  userMeta: { color: "#9693A5", fontSize: 9, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 7, marginTop: 10 },
  editButton: { backgroundColor: "#ECEEFC", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 },
  editText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  deleteButton: { backgroundColor: "#FFE8E4", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 },
  deleteText: { color: colors.coral, fontSize: 9, fontWeight: "800" },
  loading: { alignItems: "center", padding: 24 },
  empty: { alignItems: "center", backgroundColor: "#F0F1FC", borderRadius: 14, padding: 22 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 11, marginTop: 6, textAlign: "center" },
  modalBackdrop: { backgroundColor: "rgba(17,15,61,0.5)", flex: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  modalEyebrow: { color: "#0E8067", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 3 },
  close: { color: colors.ink, fontSize: 30, fontWeight: "300" },
  formLabel: { color: colors.ink, fontSize: 11, fontWeight: "800", marginBottom: 7 },
});
