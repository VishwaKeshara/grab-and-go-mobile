import { AuthFrame, AuthHeader, ErrorBanner } from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
    getDispatchSettings,
    getLatestSettlementBatch,
    listNodeMetrics,
    listReportManifests,
    setDispatchEnabled,
} from "@/services/reportsService";
import type {
    DispatchSettings,
    NodeMetric,
    ReportManifest,
    SettlementBatch,
} from "@/types/reports";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const NODE_ID = "Malabe Node";

const RANGES = ["Today", "This Week", "Monthly"] as const;
type Range = (typeof RANGES)[number];

export default function Reports() {
    const [range, setRange] = useState<Range>("Today");
    const [batch, setBatch] = useState<SettlementBatch | null>(null);
    const [metrics, setMetrics] = useState<NodeMetric[]>([]);
    const [manifests, setManifests] = useState<ReportManifest[]>([]);
    const [dispatch, setDispatch] = useState<DispatchSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            getLatestSettlementBatch(NODE_ID),
            listNodeMetrics(NODE_ID),
            listReportManifests(),
            getDispatchSettings(NODE_ID),
        ])
            .then(([latestBatch, nodeMetrics, manifestList, dispatchSettings]) => {
                setBatch(latestBatch);
                setMetrics(nodeMetrics);
                setManifests(manifestList);
                setDispatch(dispatchSettings);
            })
            .catch((loadError: unknown) => {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "We could not load the reports.",
                );
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        let active = true;

        Promise.all([
            getLatestSettlementBatch(NODE_ID),
            listNodeMetrics(NODE_ID),
            listReportManifests(),
            getDispatchSettings(NODE_ID),
        ])
            .then(([latestBatch, nodeMetrics, manifestList, dispatchSettings]) => {
                if (!active) return;
                setBatch(latestBatch);
                setMetrics(nodeMetrics);
                setManifests(manifestList);
                setDispatch(dispatchSettings);
            })
            .catch((loadError: unknown) => {
                if (!active) return;
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "We could not load the reports.",
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const latest = metrics.at(-1) ?? null;
    const previous = metrics.at(-2) ?? null;

    // Trend arrow compares the newest two days of telemetry.
    const trend = useMemo(() => {
        if (!latest || !previous) return null;
        const delta = latest.sla_hit_rate - previous.sla_hit_rate;
        return {
            up: delta >= 0,
            label: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prev. day`,
        };
    }, [latest, previous]);

    const toggleDispatch = async () => {
        if (!dispatch) return;
        const next = !dispatch.enabled;
        setDispatch({ ...dispatch, enabled: next });
        setNotice("");
        setError("");
        try {
            await setDispatchEnabled(NODE_ID, next);
            setNotice(
                next
                    ? "✓ Automated dispatch enabled"
                    : "✓ Automated dispatch paused",
            );
        } catch (saveError) {
            setDispatch({ ...dispatch, enabled: !next });
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "We could not update the dispatch setting.",
            );
        }
    };

    return (
        <AuthFrame scroll={false}>
            <AuthHeader eyebrow="SEC - L4" title="Reports And Analytics" />
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.identityRow}>
                    <View style={styles.identityChip}>
                        <Text style={styles.identityChipText}>
                            Platform Superadmin
                        </Text>
                    </View>
                    <View style={styles.identityPlain}>
                        <Text style={styles.identityPlainText}>{NODE_ID}</Text>
                    </View>
                </View>
                <View style={styles.syncStrip}>
                    <View style={styles.syncDot} />
                    <Text style={styles.syncText} numberOfLines={1}>
                        Node Pipeline: Automated Sync
                    </Text>
                    <Text style={styles.syncAgo}>
                        {batch ? relativeTime(batch.generated_at) : "--"}
                    </Text>
                </View>
                {error ? <ErrorBanner message={error} /> : null}
                {notice ? <Text style={styles.notice}>{notice}</Text> : null}
                <View style={styles.sectionHead}>
                    <View style={styles.sectionHeadCopy}>
                        <Text style={styles.sectionTitle}>
                            Operational Reports &amp; Settlement
                        </Text>
                        <Text style={styles.sectionBody}>
                            LankaPay clearing manifests, suburban transit SLA
                            telemetry &amp; statutory logs
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Refresh reports"
                        onPress={load}
                        style={styles.refreshButton}
                    >
                        <Text style={styles.refreshText}>↻</Text>
                    </Pressable>
                </View>
                <View style={styles.rangeRow}>
                    {RANGES.map((item) => {
                        const active = item === range;
                        return (
                            <Pressable
                                key={item}
                                onPress={() => setRange(item)}
                                style={[
                                    styles.rangeChip,
                                    active && styles.rangeChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.rangeText,
                                        active && styles.rangeTextActive,
                                    ]}
                                >
                                    {item}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                {loading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator color={colors.ink} />
                        <Text style={styles.loadingText}>Loading reports...</Text>
                    </View>
                ) : (
                    <>
                        <SettlementCard batch={batch} />
                        <SlaCard metric={latest} trend={trend} spark={metrics} />
                        <View style={styles.manifestHead}>
                            <Text style={styles.sectionTitle}>
                                Available Manifests
                            </Text>
                            <Text style={styles.fileCount}>
                                {manifests.length} File
                                {manifests.length === 1 ? "" : "s"}
                            </Text>
                        </View>
                        <ExportAllButton
                            disabled={manifests.length === 0}
                            onBlocked={() =>
                                setError(
                                    "Export needs expo-file-system and expo-sharing, which cannot be installed in this environment.",
                                )
                            }
                        />
                        {manifests.map((manifest) => (
                            <ManifestCard
                                key={manifest.id}
                                manifest={manifest}
                                onBlocked={() =>
                                    setError(
                                        `Downloading ${manifest.title} needs expo-file-system and expo-sharing, which cannot be installed in this environment.`,
                                    )
                                }
                            />
                        ))}
                        {manifests.length === 0 ? (
                            <View style={styles.empty}>
                                <Text style={styles.emptyTitle}>
                                    No manifests published
                                </Text>
                                <Text style={styles.emptyText}>
                                    Manifests will appear here once an admin
                                    publishes them.
                                </Text>
                            </View>
                        ) : null}
                    </>
                )}
                {dispatch ? (
                    <DispatchCard dispatch={dispatch} onToggle={toggleDispatch} />
                ) : null}
            </ScrollView>
        </AuthFrame>
    );
}

function SettlementCard({ batch }: { batch: SettlementBatch | null }) {
    if (!batch) {
        return (
            <View style={styles.card}>
                <Text style={styles.emptyText}>No settlement batch yet.</Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <View style={styles.cardTopCopy}>
                    <Text style={styles.eyebrow}>{batch.provider.toUpperCase()}</Text>
                    <Text style={styles.eyebrow}>SETTLEMENT</Text>
                </View>
                <View style={styles.goodPill}>
                    <Text style={styles.goodPillText}>{batch.batch_reference}</Text>
                </View>
            </View>
            <View style={styles.amountRow}>
                <View style={styles.bankIcon}>
                    <Text style={styles.bankIconText}>🏦</Text>
                </View>
                <View style={styles.amountCopy}>
                    <Text style={styles.amountLabel}>LKR</Text>
                    <Text style={styles.amount}>
                        {batch.total_amount.toLocaleString("en-LK", {
                            maximumFractionDigits: 0,
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.bufferRow}>
                <Text style={styles.bufferLabel}>Clearing Buffer</Text>
                <Text style={styles.bufferValue}>{batch.clearing_buffer}</Text>
            </View>
            <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
            </View>
            <View style={styles.footerRow}>
                <View style={styles.footerItem}>
                    {batch.matched ? (
                        <Text style={styles.check}>✓</Text>
                    ) : (
                        <Text style={styles.cross}>!</Text>
                    )}
                    <Text style={styles.footerText}>{batch.gateway_name}</Text>
                    <Text style={styles.footerMuted}>
                        {batch.matched ? "Matched" : "Pending"}
                    </Text>
                </View>
                <View style={styles.footerItemRight}>
                    <Text style={styles.footerStrong}>
                        {batch.matched ? "100%" : "0%"}
                    </Text>
                    <Text style={styles.footerMuted}>matched</Text>
                </View>
            </View>
        </View>
    );
}

function SlaCard({
    metric,
    trend,
    spark,
}: {
    metric: NodeMetric | null;
    trend: { up: boolean; label: string } | null;
    spark: NodeMetric[];
}) {
    const points = spark.map((item) => item.sla_hit_rate);
    const path = sparkPath(points, 62, 22);

    return (
        <View style={styles.card}>
            <View style={styles.slaHead}>
                <View style={styles.slaIcon}>
                    <Text style={styles.slaIconText}>⤢</Text>
                </View>
                <View style={styles.slaHeadCopy}>
                    <Text style={styles.eyebrow}>COMMUTER QUEUE BYPASS</Text>
                    <Text style={styles.slaTitle}>
                        {metric
                            ? `${metric.avg_handover_seconds.toFixed(1)}s`
                            : "--"}
                        <Text style={styles.slaTitleMuted}> Avg Handover</Text>
                    </Text>
                </View>
                <Text style={styles.slaValue}>
                    {metric ? `${metric.sla_hit_rate.toFixed(1)}%` : "--"}
                </Text>
            </View>
            <Text style={styles.slaMeta}>SLA Hit Rate</Text>
            <View style={styles.sparkRow}>
                <View style={styles.sparkCopy}>
                    <Text style={styles.slaRoute}>
                        {metric?.route_label ?? "No route data"}
                    </Text>
                    <Text style={styles.slaDetail}>{metric?.detail ?? ""}</Text>
                    {trend ? (
                        <View style={styles.trendRow}>
                            <Text
                                style={[
                                    styles.trendText,
                                    !trend.up && styles.trendTextDown,
                                ]}
                            >
                                {trend.up ? "▲" : "▼"} {trend.label}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.sparkBox}>
                    <Sparkline color={colors.mint} path={path} />
                </View>
            </View>
        </View>
    );
}

function ManifestCard({
    manifest,
    onBlocked,
}: {
    manifest: ReportManifest;
    onBlocked: () => void;
}) {
    const actions = manifest.metrics.actions ?? [];

    return (
        <View style={styles.card}>
            <View style={styles.manifestHeadRow}>
                <View
                    style={[
                        styles.manifestIcon,
                        { backgroundColor: toneColor(manifest.tone) },
                    ]}
                >
                    <Text style={styles.manifestIconText}>
                        {manifestIcon(manifest.icon)}
                    </Text>
                </View>
                <View style={styles.manifestCopy}>
                    <Text style={styles.manifestTitle}>{manifest.title}</Text>
                    <View style={styles.manifestMetaRow}>
                        <View style={styles.tagPill}>
                            <Text style={styles.tagText}>{manifest.tag}</Text>
                        </View>
                        <Text style={styles.manifestMeta}>
                            {manifest.file_formats.join(" • ")}
                            {manifest.size_label
                                ? ` • ${manifest.size_label}`
                                : ""}
                        </Text>
                    </View>
                </View>
                {manifest.locked ? (
                    <Text style={styles.lock}>🔒</Text>
                ) : null}
            </View>
            {manifest.status_label ? (
                <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                        ✓ {manifest.status_label}
                    </Text>
                </View>
            ) : null}
            {manifest.detail ? (
                <View style={styles.detailRow}>
                    <Text style={styles.detailPin}>⌖</Text>
                    <Text style={styles.detailText}>{manifest.detail}</Text>
                </View>
            ) : null}
            <View style={styles.metricRow}>
                {manifest.metrics.approved_substitutions !== undefined ? (
                    <Metric
                        label="Approved Sub"
                        tone="amber"
                        value={String(manifest.metrics.approved_substitutions)}
                    />
                ) : null}
                {manifest.metrics.phone_contact !== undefined ? (
                    <Metric
                        label="Phone Contact"
                        tone="violet"
                        value={String(manifest.metrics.phone_contact)}
                    />
                ) : null}
                {manifest.metrics.disputes !== undefined ? (
                    <Metric
                        label="Disputes"
                        tone="mint"
                        value={String(manifest.metrics.disputes)}
                    />
                ) : null}
                {manifest.metrics.ramis_compliant !== undefined ? (
                    <Metric
                        label="RAMIS Compliant"
                        tone="mint"
                        value={manifest.metrics.ramis_compliant ? "Yes" : "No"}
                    />
                ) : null}
                {manifest.metrics.vat_rate !== undefined ? (
                    <Metric
                        label="VAT Tracked"
                        tone="ink"
                        value={`${manifest.metrics.vat_rate}%`}
                    />
                ) : null}
            </View>
            <View style={styles.actionRow}>
                {actions.map((action) => (
                    <ActionButton
                        key={action}
                        action={action}
                        locked={manifest.locked}
                        manifestTitle={manifest.title}
                        onBlocked={onBlocked}
                    />
                ))}
            </View>
        </View>
    );
}

function ActionButton({
    action,
    locked,
    manifestTitle,
    onBlocked,
}: {
    action: string;
    locked: boolean;
    manifestTitle: string;
    onBlocked: () => void;
}) {
    const label = ACTION_LABELS[action] ?? action;
    const primary = action !== "share-boc";

    return (
        <Pressable
            accessibilityLabel={label}
            onPress={onBlocked}
            style={({ pressed }) => [
                styles.actionButton,
                primary ? styles.actionPrimary : styles.actionGhost,
                pressed && styles.pressed,
            ]}
        >
            <Text
                style={[
                    styles.actionText,
                    primary ? styles.actionTextPrimary : styles.actionTextGhost,
                ]}
            >
                {locked ? "🔒 " : ""}
                {label}
            </Text>
        </Pressable>
    );
}

function DispatchCard({
    dispatch,
    onToggle,
}: {
    dispatch: DispatchSettings;
    onToggle: () => void;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.manifestHeadRow}>
                <View style={[styles.manifestIcon, { backgroundColor: "#F3F4F6" }]}>
                    <Text style={styles.manifestIconText}>✉</Text>
                </View>
                <View style={styles.manifestCopy}>
                    <Text style={styles.manifestTitle}>Automated Dispatch</Text>
                    <View style={styles.manifestMetaRow}>
                        <View style={styles.tagPill}>
                            <Text style={styles.tagText}>
                                {dispatch.window_label}
                            </Text>
                        </View>
                    </View>
                </View>
                <Pressable
                    accessibilityLabel="Toggle automated dispatch"
                    accessibilityRole="switch"
                    accessibilityState={{ checked: dispatch.enabled }}
                    onPress={onToggle}
                    style={[styles.toggle, dispatch.enabled && styles.toggleOn]}
                >
                    <View
                        style={[
                            styles.toggleKnob,
                            dispatch.enabled && styles.toggleKnobOn,
                        ]}
                    />
                </Pressable>
            </View>
            <View style={styles.dispatchRow}>
                <Text style={styles.dispatchLabel}>Target Recipient</Text>
                <Text style={styles.dispatchValue}>{dispatch.recipient_email}</Text>
            </View>
            <View style={styles.dispatchRow}>
                <Text style={styles.dispatchLabel}>Format Payload</Text>
                <Text style={styles.dispatchValue}>{dispatch.payload_label}</Text>
            </View>
        </View>
    );
}

function ExportAllButton({
    disabled,
    onBlocked,
}: {
    disabled: boolean;
    onBlocked: () => void;
}) {
    return (
        <Pressable
            accessibilityLabel="Export all manifests"
            disabled={disabled}
            onPress={onBlocked}
            style={({ pressed }) => [
                styles.exportAll,
                disabled && styles.disabled,
                pressed && styles.pressed,
            ]}
        >
            <Text style={styles.exportAllText}>Export All ⬇</Text>
        </Pressable>
    );
}

function Metric({
    label,
    tone,
    value,
}: {
    label: string;
    tone: "amber" | "violet" | "mint" | "ink";
    value: string;
}) {
    return (
        <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: toneColor(tone) }]}>
                {value}
            </Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

function Sparkline({ color, path }: { color: string; path: string }) {
    const points = path.split(" ").filter(Boolean);

    if (points.length === 0) {
        return <View style={styles.sparkSvg} />;
    }

    return (
        <View style={styles.sparkSvg}>
            {points.map((point, index) => {
                const [x, y] = point.split(",");
                return (
                    <View
                        key={index}
                        style={[
                            styles.sparkSegment,
                            {
                                backgroundColor: color,
                                left: Number(x),
                                top: Number(y),
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
}

/** Builds "x,y" pairs for the sparkline from a series of values. */
function sparkPath(values: number[], width: number, height: number) {
    if (values.length === 0) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = values.length > 1 ? width / (values.length - 1) : width;

    return values
        .map((value, index) => {
            const x = Math.round(index * step);
            const y = Math.round(height - ((value - min) / span) * height);
            return `${x},${y}`;
        })
        .join(" ");
}

function relativeTime(value: string) {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "--";
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.round(minutes / 60)}h ago`;
}

function toneColor(tone: string) {
    switch (tone) {
        case "amber":
            return colors.amber;
        case "mint":
            return colors.mint;
        case "coral":
            return colors.coral;
        case "violet":
            return "#4B5563";
        default:
            return colors.ink;
    }
}

function manifestIcon(icon: string) {
    switch (icon) {
        case "payout":
            return "▤";
        case "stock":
            return "⊕";
        case "transit":
            return "▦";
        case "tax":
            return "◉";
        default:
            return "▤";
    }
}

const ACTION_LABELS: Record<string, string> = {
    "download-pdf": "⬇ Download PDF",
    "download-log": "⬇ Download Log",
    "download-xlsx": "⬇ Download XLSX",
    "export-ird": "Export IRD File",
    "share-boc": "▷ Share to BOC",
};

const styles = StyleSheet.create({
    scroll: { paddingBottom: 30 },
    identityRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
    identityChip: {
        backgroundColor: colors.ink,
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    identityChipText: { color: colors.mint, fontSize: 12, fontWeight: "600" },
    identityPlain: {
        backgroundColor: "#F3F4F6",
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    identityPlainText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
    syncStrip: {
        alignItems: "center",
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: "row",
        marginBottom: 16,
        padding: 11,
    },
    syncDot: {
        backgroundColor: colors.mint,
        borderRadius: 4,
        height: 8,
        marginRight: 7,
        width: 8,
    },
    syncText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700" },
    syncAgo: {fontWeight: "400", color: colors.muted, fontSize: 12, marginLeft: 7 },
    notice: {
        color: "#15803D",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 12,
    },
    sectionHead: { flexDirection: "row", marginBottom: 12 },
    sectionHeadCopy: { flex: 1 },
    sectionTitle: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: "600",
        letterSpacing: -0.2,
    },
    sectionBody: {fontWeight: "400", color: colors.muted,
        fontSize: 12,
        lineHeight: 15,
        marginTop: 4,
        maxWidth: 230,
    },
    refreshButton: {
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 14,
        height: 28,
        justifyContent: "center",
        width: 28,
    },
    refreshText: {fontWeight: "400", color: colors.ink, fontSize: 15 },
    rangeRow: { flexDirection: "row", gap: 7, marginBottom: 16 },
    rangeChip: {
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 13,
        paddingVertical: 8,
    },
    rangeChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    rangeText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
    rangeTextActive: { color: colors.white },
    card: {
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        padding: 13,
    },
    cardTop: { flexDirection: "row" },
    cardTopCopy: { flex: 1 },
    eyebrow: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    goodPill: {
        alignSelf: "flex-start",
        backgroundColor: colors.mintSoft,
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    goodPillText: { color: "#15803D", fontSize: 12, fontWeight: "600" },
    amountRow: { alignItems: "center", flexDirection: "row", marginTop: 12 },
    bankIcon: {
        alignItems: "center",
        backgroundColor: colors.mintSoft,
        borderRadius: 11,
        height: 40,
        justifyContent: "center",
        width: 40,
    },
    bankIconText: { fontSize: 18 },
    amountCopy: { flex: 1, marginLeft: 11 },
    amountLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    amount: {
        color: colors.ink,
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: -0.5,
    },
    bufferRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 13,
    },
    bufferLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 },
    bufferValue: { color: colors.ink, fontSize: 12, fontWeight: "700" },
    progressTrack: {
        backgroundColor: "#F3F4F6",
        borderRadius: 3,
        height: 6,
        marginTop: 8,
        overflow: "hidden",
    },
    progressFill: {
        backgroundColor: colors.mint,
        borderRadius: 3,
        height: 6,
        width: "100%",
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
    },
    footerItem: { alignItems: "center", flexDirection: "row", flex: 1 },
    footerItemRight: { alignItems: "flex-end" },
    check: { color: "#15803D", fontSize: 12, fontWeight: "900", marginRight: 5 },
    cross: { color: colors.coral, fontSize: 12, fontWeight: "900", marginRight: 5 },
    footerText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
    footerStrong: { color: colors.ink, fontSize: 12, fontWeight: "700" },
    footerMuted: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 2 },
    slaHead: { alignItems: "center", flexDirection: "row" },
    slaIcon: {
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 10,
        height: 32,
        justifyContent: "center",
        width: 32,
    },
    slaIconText: {fontWeight: "400", color: colors.ink, fontSize: 14 },
    slaHeadCopy: { flex: 1, marginLeft: 10 },
    slaTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
    slaTitleMuted: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    slaValue: { color: "#15803D", fontSize: 17, fontWeight: "700" },
    slaMeta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 6 },
    sparkRow: { flexDirection: "row", marginTop: 10 },
    sparkCopy: { flex: 1 },
    slaRoute: { color: colors.ink, fontSize: 12, fontWeight: "600" },
    slaDetail: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
    trendRow: { flexDirection: "row", marginTop: 7 },
    trendText: { color: "#15803D", fontSize: 12, fontWeight: "600" },
    trendTextDown: { color: colors.coral },
    sparkBox: { height: 26, justifyContent: "center", width: 64 },
    sparkSvg: { height: 26, width: 64 },
    sparkSegment: {
        borderRadius: 3,
        height: 4,
        position: "absolute",
        width: 4,
    },
    manifestHead: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    fileCount: {fontWeight: "400", color: colors.muted, fontSize: 12 },
    exportAll: { alignItems: "flex-end", marginBottom: 12, paddingVertical: 4 },
    exportAllText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
    manifestHeadRow: { flexDirection: "row" },
    manifestIcon: {
        alignItems: "center",
        borderRadius: 10,
        height: 34,
        justifyContent: "center",
        width: 34,
    },
    manifestIconText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
    manifestCopy: { flex: 1, marginLeft: 10 },
    manifestTitle: { color: colors.ink, fontSize: 12, fontWeight: "600" },
    manifestMetaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 5 },
    tagPill: {
        backgroundColor: "#F3F4F6",
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    tagText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
    manifestMeta: {fontWeight: "400", color: colors.muted, fontSize: 12 },
    lock: {fontWeight: "400", alignSelf: "flex-start", fontSize: 12 },
    statusPill: {
        backgroundColor: colors.mintSoft,
        borderRadius: 7,
        marginTop: 10,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    statusText: { color: "#15803D", fontSize: 12, fontWeight: "700" },
    detailRow: { alignItems: "flex-start", flexDirection: "row", marginTop: 10 },
    detailPin: { color: colors.muted, fontSize: 12, marginRight: 6 },
    detailText: { fontWeight: "400", color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
    metricRow: { flexDirection: "row", gap: 16, marginTop: 12 },
    metric: { alignItems: "center" },
    metricValue: { fontSize: 15, fontWeight: "700" },
    metricLabel: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 2 },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 13 },
    actionButton: {
        alignItems: "center",
        borderRadius: 9,
        flex: 1,
        justifyContent: "center",
        minHeight: 40,
        paddingHorizontal: 8,
    },
    actionPrimary: { backgroundColor: colors.ink },
    actionGhost: {
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderWidth: 1,
    },
    actionText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
    actionTextPrimary: { color: colors.white },
    actionTextGhost: { color: colors.ink },
    dispatchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    dispatchLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 },
    dispatchValue: {
        color: colors.ink,
        flex: 1,
        fontSize: 12,
        fontWeight: "700",
        marginLeft: 10,
        textAlign: "right",
    },
    toggle: {
        backgroundColor: "#D1D5DB",
        borderRadius: 13,
        height: 26,
        justifyContent: "center",
        paddingHorizontal: 3,
        width: 46,
    },
    toggleOn: { backgroundColor: colors.mint },
    toggleKnob: {
        backgroundColor: colors.white,
        borderRadius: 10,
        height: 20,
        width: 20,
    },
    toggleKnobOn: { alignSelf: "flex-end" },
    loading: { alignItems: "center", paddingVertical: 30 },
    loadingText: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 9 },
    empty: {
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 13,
        marginBottom: 12,
        padding: 22,
    },
    emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
    emptyText: {fontWeight: "400", color: colors.muted,
        fontSize: 13,
        lineHeight: 15,
        marginTop: 5,
        textAlign: "center",
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75 },
});