import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../AuthContext";
import { checkServerHealth } from "../api";
import { API_BASE_URL } from "../config";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const onSubmit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onTestConnection = async () => {
    setChecking(true);
    setConnectionStatus(null);
    const result = await checkServerHealth();
    setConnectionStatus(result);
    setChecking(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>🛵</Text>
        <Text style={styles.title}>RiderDash</Text>
        <Text style={styles.subtitle}>Rider Login</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email / Username</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@riderdash.com"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Don&apos;t have an account? Ask your admin to create one for you — riders cannot self-register.
        </Text>

        <View style={styles.serverBox}>
          <Text style={styles.serverLabel}>Server</Text>
          <Text style={styles.serverUrl} numberOfLines={1}>
            {API_BASE_URL}
          </Text>
          <TouchableOpacity style={styles.testButton} onPress={onTestConnection} disabled={checking}>
            {checking ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <Text style={styles.testButtonText}>Test Connection</Text>
            )}
          </TouchableOpacity>
          {connectionStatus && (
            <Text style={[styles.connectionText, { color: connectionStatus.ok ? "#047857" : "#dc2626" }]}>
              {connectionStatus.ok ? "✅ " : "❌ "}
              {connectionStatus.message}
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2ff", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  logo: { fontSize: 40, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", color: "#0f172a", marginTop: 4 },
  subtitle: { fontSize: 14, textAlign: "center", color: "#64748b", marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0f172a" },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 10, textAlign: "center" },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 18, lineHeight: 18 },
  serverBox: { marginTop: 20, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 16, alignItems: "center" },
  serverLabel: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  serverUrl: { fontSize: 12, color: "#475569", marginTop: 2, maxWidth: "100%" },
  testButton: { marginTop: 10, borderWidth: 1, borderColor: "#c7d2fe", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  testButtonText: { color: "#4338ca", fontWeight: "600", fontSize: 12 },
  connectionText: { fontSize: 12, marginTop: 10, textAlign: "center" },
});
