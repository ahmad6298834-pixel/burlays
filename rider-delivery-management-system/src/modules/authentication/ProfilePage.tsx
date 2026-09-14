"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";

type Admin = { id: number; name: string; username: string; email: string | null; role: string };

export default function ProfilePage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/profile")
      .then((r) => r.json())
      .then((d: Admin) => {
        setAdmin(d);
        setName(d.name);
        setUsername(d.username);
        setEmail(d.email ?? "");
      });
  }, []);

  const save = async (payload: Record<string, unknown>, okMsg: string) => {
    setMsg("");
    setError("");
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Could not save changes");
      return false;
    }
    setAdmin(d);
    setMsg(okMsg);
    return true;
  };

  const saveDetails = () => save({ name, username, email }, "Profile details updated.");

  const savePassword = async () => {
    if (newPassword.length < 8) return setError("New password must be at least 8 characters");
    if (newPassword !== confirmPassword) return setError("New password and confirmation do not match");
    const ok = await save({ currentPassword, newPassword, confirmPassword }, "Password changed. Use it next time you sign in.");
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (!admin) return <p className="text-sm text-slate-500">Loading profile...</p>;

  return (
    <div>
      <PageHeader title="My Profile" subtitle={`Signed in as ${admin.username} · ${admin.role}`} />

      {msg && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Card className="mb-4 max-w-xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Account Details</h2>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveDetails}>Save Details</Button>
        </div>
      </Card>

      <Card className="max-w-xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Change Password</h2>
        <div className="space-y-3">
          <div>
            <Label>Current Password</Label>
            <Input
              type={show ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>New Password (min 8 characters)</Label>
            <Input
              type={show ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input
              type={show ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={savePassword}>Change Password</Button>
        </div>
      </Card>
    </div>
  );
}
