import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
    listManagedUsers,
    ManagedUser,
    updateManagedUserStatus,
} from "@/services/adminService";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listManagedUsers()
      .then(setUsers)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Admin access is required.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesFilter = filter === "all" || user.status === filter;
        const term = search.trim().toLowerCase();
        return (
          matchesFilter &&
          (!term ||
            `${user.full_name} ${user.email ?? ""} ${user.phone ?? ""}`
              .toLowerCase()
              .includes(term))
        );
      }),
    [filter, search, users],
  );

  const toggleStatus = async (user: ManagedUser) => {
    const status = user.status === "active" ? "suspended" : "active";
    try {
      await updateManagedUserStatus(user.id, status);
      setUsers((items) =>
        items.map((item) => (item.id === user.id ? { ...item, status } : item)),
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update this account.",
      );
    }
  };

  return (
    <AuthFrame>
      <AuthHeader eyebrow="ADMIN • MALABE" title="User Management" />
      <View style={styles.adminHero}>
        <View>
          <Text style={styles.heroEyebrow}>LIVE USER REGISTRY</Text>
          <Text style={styles.heroTitle}>
            {users.length.toLocaleString()} accounts
          </Text>
          <Text style={styles.heroText}>
            Monitor access, pickup eligibility, and account health.
          </Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeValue}>
            {users.filter((user) => user.status === "active").length}
          </Text>
          <Text style={styles.heroBadgeLabel}>active</Text>
        </View>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <Field
        label="Search users"
        onChangeText={setSearch}
        placeholder="Name, email or phone"
        value={search}
      />
      <View style={styles.filters}>
        {(["all", "active", "suspended"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filter, filter === item && styles.filterActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.filterTextActive,
              ]}
            >
              {item === "all" ? "All users" : item}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <Text style={styles.emptyText}>Loading user registry...</Text>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyText}>Try another search or filter.</Text>
        </View>
      ) : (
        filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onToggle={() => toggleStatus(user)}
          />
        ))
      )}
      <SecondaryButton onPress={() => undefined}>
        Export user list
      </SecondaryButton>
    </AuthFrame>
  );
}

function UserCard({
  user,
  onToggle,
}: {
  user: ManagedUser;
  onToggle: () => void;
}) {
  const active = user.status === "active";
  return (
    <View style={styles.userCard}>
      <View style={[styles.userAvatar, !active && styles.userAvatarSuspended]}>
        <Text style={styles.avatarText}>
          {user.full_name.slice(0, 2).toUpperCase() || "NA"}
        </Text>
      </View>
      <View style={styles.userCopy}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>
            {user.full_name || "Unnamed account"}
          </Text>
          <View
            style={[
              styles.statusPill,
              active ? styles.activePill : styles.suspendedPill,
            ]}
          >
            <Text style={styles.statusText}>
              {active ? "Verified active" : "Suspended"}
            </Text>
          </View>
        </View>
        <Text style={styles.userContact}>
          {user.email || user.phone || "No contact details"}
        </Text>
        <Text style={styles.userMeta}>
          {user.role} • joined {new Date(user.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            onPress={onToggle}
            style={[
              styles.actionButton,
              active ? styles.suspendButton : styles.activateButton,
            ]}
          >
            <Text style={[styles.actionText, !active && styles.activateText]}>
              {active ? "Suspend account" : "Reactivate account"}
            </Text>
          </Pressable>
          <Pressable onPress={() => undefined} style={styles.viewButton}>
            <Text style={styles.viewText}>View details</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adminHero: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 17,
    padding: 16,
  },
  heroEyebrow: {
    color: colors.mint,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },
  heroText: {
    color: "#CFCDF9",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
    maxWidth: 190,
  },
  heroBadge: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 35,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  heroBadgeValue: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  heroBadgeLabel: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  filters: { flexDirection: "row", gap: 7, marginBottom: 15 },
  filter: {
    backgroundColor: "#ECEEFC",
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterActive: { backgroundColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  filterTextActive: { color: colors.white },
  userCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 11,
  },
  userAvatar: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
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
  actionButton: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  suspendButton: { backgroundColor: "#FFE8E4" },
  activateButton: { backgroundColor: colors.mintSoft },
  actionText: { color: colors.coral, fontSize: 9, fontWeight: "800" },
  activateText: { color: "#07856A" },
  viewButton: {
    backgroundColor: "#ECEEFC",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  viewText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 14,
    padding: 22,
  },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
});
