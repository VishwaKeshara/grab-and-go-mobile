import {
  ActionButton,
  Card,
  ErrorText,
  InfoRow,
  LinkButton,
  OrderPage,
  SectionTitle,
  StatusBadge,
  StatusTimeline,
  prettySlot,
} from "@/components/OrderUI";
import {
  OrderActionDialog,
  type OrderDialogContent,
} from "@/components/OrderActionDialog";
import { colors, accentOnDark } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { callShop } from "@/services/shopContactService";
import { shopTelUrl } from "@/utils/shopPhone";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, loading, error, reloadOrders } = useOrders();

  const [qrFailed, setQrFailed] = useState(false);
  const [dialog, setDialog] = useState<OrderDialogContent | null>(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    void reloadOrders();

    const timer = setInterval(() => {
      void reloadOrders();
    }, 10000);

    return () => clearInterval(timer);
  }, [reloadOrders]);

  const order = orders.find((value) => value.id === id);

  if (!order) {
    return (
      <OrderPage title="Order tracking" back={() => router.back()}>
        <ErrorText message={error} />

        <Card>
          <Text style={styles.missing}>
            {loading
              ? "Loading tracking…"
              : "This order could not be found."}
          </Text>

          <LinkButton
            label="My orders"
            onPress={() => router.replace("/(customer)/my-orders")}
          />
        </Card>
      </OrderPage>
    );
  }

  const contact = async () => {
    if (calling) return;

    const phone = order.shop.phone;

    if (!phone?.trim()) {
      setDialog({
        tone: "info",
        title: "Phone number unavailable",
        message: `${order.shop.name} has not shared a phone number yet. Please ask at the pickup counter.`,
      });
      return;
    }

    const url = shopTelUrl(phone);

    if (!url) {
      setDialog({
        tone: "info",
        title: "Phone number unavailable",
        message:
          "This shop's phone number could not be used. Please ask at the pickup counter for a current number.",
      });
      return;
    }

    setCalling(true);
    setDialog(null);

    try {
      const notice = await callShop(phone);

      if (notice) {
        setDialog({
          tone: "info",
          title: "Call the shop",
          message: notice,
        });
      }
    } catch {
      setDialog({
        tone: "error",
        title: "Could not open the dialer",
        message: `Your device could not open a phone app. You can call ${url.slice(
          4,
        )} from a phone instead.`,
      });
    } finally {
      setCalling(false);
    }
  };

  const qrData = `GRABGO:${order.reference}`;
  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      qrData,
    )}`;

  return (
    <>
      <OrderPage
        title="Order tracking"
        eyebrow="LIVE ORDER PASS"
        back={() => router.back()}
        footer={
          <View style={{ gap: 12 }}>
            <LinkButton
              label="Back to Home"
              onPress={() => router.replace("/(customer)/home")}
            />
            <ActionButton
              label="View order details"
              icon="arrow-right"
              onPress={() =>
                router.push({
                  pathname: "/(customer)/order-details",
                  params: { id: order.id },
                })
              }
            />
          </View>
        }
      >
        <ErrorText message={error} />

        <Card dark>
          <View style={styles.passTop}>
            <Text style={styles.passLabel}>
              GRAB & GO · PICKUP PASS
            </Text>

            <FontAwesome
              name="shopping-basket"
              color={colors.mint}
              size={19}
            />
          </View>

          <Text style={styles.reference}>
            {order.reference}
          </Text>

          <Text style={styles.passMeta}>
            {order.shop.name} · {order.shop.counter}
          </Text>

          <Text style={styles.passMeta}>
            {prettySlot(order.draft.pickupSlot)}
          </Text>

          <View style={styles.qrWrap}>
            {qrFailed ? (
              <Text style={styles.qrFallback}>
                QR unavailable.{"\n"}Use your pickup PIN below.
              </Text>
            ) : (
              <Image
                source={qrUrl}
                accessibilityLabel={`Pickup QR code for ${order.reference}`}
                contentFit="contain"
                onError={() => setQrFailed(true)}
                style={styles.qr}
              />
            )}
          </View>

          <Text style={styles.pinLabel}>PICKUP PIN</Text>
          <Text style={styles.pin}>{order.pin}</Text>
        </Card>

        <View style={styles.statusRow}>
          <SectionTitle title="Order status" />
          <StatusBadge status={order.status} />
        </View>

        <StatusTimeline status={order.status} />

        <Card>
          <InfoRow
            icon="clock-o"
            label="Preparation"
            value={`Usually about ${order.shop.prepMinutes} minutes`}
          />

          <InfoRow
            icon="map-marker"
            label="Where to collect"
            value={`${order.shop.counter}, ${order.shop.address}`}
          />

          <InfoRow
            icon="phone"
            label="Shop phone"
            value={order.shop.phone ?? "Not available"}
          />

          <Text style={styles.instructions}>
            Show the QR code or PIN at the counter. Have your payment
            ready if you chose pay at pickup.
          </Text>
        </Card>

        <LinkButton
          label="Contact the shop"
          icon="phone"
          loading={calling}
          onPress={() => {
            void contact();
          }}
        />

        {order.status !== "cancelled" &&
        order.status !== "collected" ? (
          <Card>
            <Text style={styles.demoTitle}>
              Live order status
            </Text>

            <Text style={styles.demoCopy}>
              Updates from the shop appear here as your order is
              prepared.
            </Text>

            <ActionButton
              label="Refresh status"
              light
              onPress={() => {
                void reloadOrders();
              }}
            />
          </Card>
        ) : null}
      </OrderPage>

      <OrderActionDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  passTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  passLabel: {
    color: accentOnDark,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  reference: {
    color: colors.white,
    fontSize: 25,
    fontWeight: "700",
    marginTop: 10,
  },
  passMeta: {fontWeight: "400", color: "#D1D5DB",
    fontSize: 12,
    marginTop: 6,
  },
  qrWrap: {
    width: 182,
    height: 182,
    backgroundColor: colors.white,
    alignSelf: "center",
    borderRadius: 16,
    padding: 9,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  qr: {
    width: 164,
    height: 164,
  },
  qrFallback: {fontWeight: "400", color: colors.muted,
    textAlign: "center",
    fontSize: 12,
  },
  pinLabel: {
    color: accentOnDark,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
    letterSpacing: 1,
  },
  pin: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 8,
    textAlign: "center",
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  instructions: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  demoTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  demoCopy: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    marginBottom: 12,
  },
  missing: {fontWeight: "400", color: colors.muted,
    fontSize: 13,
    marginBottom: 13,
  },
});
