import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Cpu,
  Cloud,
  Zap,
} from "lucide-react-native";
import { chatWithLLM, type ChatResponse } from "../src/data/api";
import { colors, shadows } from "../src/constants/theme";

type Provider = "auto" | "local" | "together" | "openai";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  provider?: string;
}

const PROVIDER_LABELS: Record<Provider, { label: string; color: string; Icon: React.FC<any> }> = {
  auto: { label: "Auto", color: colors.sage, Icon: Zap },
  local: { label: "Local LLM", color: colors.amber, Icon: Cpu },
  together: { label: "Together AI", color: colors.blue, Icon: Cloud },
  openai: { label: "OpenAI", color: colors.lavender, Icon: Cloud },
};

export default function DevChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>("auto");
  const listRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res: ChatResponse = await chatWithLLM(text, provider);
      const botMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.reply || "(empty response)",
        provider: res.provider,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: `Connection error: ${e.message ?? "Device unreachable"}`,
          provider: "error",
        },
      ]);
    }
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, loading, provider]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[st.bubble, isUser ? st.userBubble : st.botBubble]}>
        <View style={st.roleRow}>
          {isUser ? (
            <User color={colors.blue} size={12} />
          ) : (
            <Bot color={colors.sage} size={12} />
          )}
          <Text style={[st.roleLabel, { color: isUser ? colors.blue : colors.sage }]}>
            {isUser ? "You" : "LLM"}
          </Text>
          {item.provider && !isUser && (
            <View style={st.providerTag}>
              <Text style={st.providerText}>{item.provider}</Text>
            </View>
          )}
        </View>
        <Text style={st.msgText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <View>
          <Text style={st.title}>LLM Chat</Text>
          <Text style={st.subtitle}>Debug console</Text>
        </View>
      </View>

      {/* Provider selector */}
      <View style={st.providerRow}>
        {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => {
          const { label, color, Icon } = PROVIDER_LABELS[p];
          const active = provider === p;
          return (
            <Pressable
              key={p}
              onPress={() => setProvider(p)}
              style={[
                st.providerChip,
                active && { backgroundColor: color + "18", borderColor: color },
              ]}
            >
              <Icon color={active ? color : colors.textMuted} size={12} />
              <Text
                style={[st.providerChipText, active && { color }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={st.list}
        ListEmptyComponent={
          <View style={st.empty}>
            <Bot color={colors.textMuted} size={36} />
            <Text style={st.emptyText}>
              Send a message to test the on-device LLM
            </Text>
            <Text style={st.emptyHint}>
              Select a provider above or use Auto
            </Text>
          </View>
        }
        onContentSizeChange={() =>
          messages.length > 0 && listRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Input */}
      <View style={st.inputBar}>
        <TextInput
          style={st.input}
          placeholder="Ask the LLM anything..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!loading}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={loading || !input.trim()}
          style={({ pressed }) => [
            st.sendBtn,
            (!input.trim() || loading) && st.sendBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Send color={colors.white} size={18} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "500", color: colors.textMuted },

  providerRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  providerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  providerChipText: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.2 },

  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  emptyHint: { fontSize: 12, color: colors.textMuted },

  bubble: { borderRadius: 18, padding: 14, maxWidth: "88%" },
  userBubble: {
    backgroundColor: colors.blueFaint,
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    ...shadows.sm,
  },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  roleLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  providerTag: {
    marginLeft: "auto",
    backgroundColor: colors.cream,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  providerText: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.3 },
  msgText: { fontSize: 15, fontWeight: "400", color: colors.text, lineHeight: 22 },

  inputBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted, opacity: 0.4 },
});
