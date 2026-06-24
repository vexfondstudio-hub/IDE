import { getAccessToken } from "./auth";

export async function uploadToDrive(fileName: string, content: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const metadata = {
    name: fileName,
    mimeType: "text/plain",
  };

  const file = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error("Failed to upload to Drive");
  }

  return await response.json();
}

export async function sendEmail(to: string, subject: string, body: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const emailLines = [
    `To: ${to}`,
    "Subject: " + subject,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ];
  const email = emailLines.join("\r\n");
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: base64EncodedEmail,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to send email");
  }

  return await response.json();
}
